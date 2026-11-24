import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { ArrowLeft, Clock, LogIn, LogOut, ShieldCheck } from 'lucide-react';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  signInWithGoogle,
  signOutUser,
} from './lib/firebase';
import { bootstrapCatalogIfEmpty, ensureUserAccount } from './lib/firestoreService';
import {
  DEFAULT_SERVICES,
  DEFAULT_SHOP_SETTINGS,
  type ServiceRate,
  type ShopSettings,
  type UserAccount,
} from './types/youlaba';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OrderStatusPage } from './components/OrderStatusPage';
import { PublicStorefront } from './components/PublicStorefront';
import { WorkspaceApp } from './components/WorkspaceApp';
import { normalizeClaimSlip } from './types/youlaba';

type AppView = 'public' | 'status' | 'portal';

function getInitialRoute(): { view: AppView; slipCode: string } {
  const params = new URLSearchParams(window.location.search);
  const track = params.get('track');
  if (track !== null) {
    return { view: 'status', slipCode: normalizeClaimSlip(track) };
  }
  return { view: 'public', slipCode: '' };
}

function YouLabaApp() {
  const initialRoute = getInitialRoute();
  const [view, setView] = useState<AppView>(initialRoute.view);
  const [statusSlipCode, setStatusSlipCode] = useState<string>(initialRoute.slipCode);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState('');

  const [services, setServices] = useState<ServiceRate[]>(DEFAULT_SERVICES);
  const [servicesEmptyInDb, setServicesEmptyInDb] = useState(false);
  const [catalogBootstrapped, setCatalogBootstrapped] = useState(false);
  const [shopSettings, setShopSettings] = useState<ShopSettings>(DEFAULT_SHOP_SETTINGS);

  // Sync browser Back/Forward with ?track= query parameter
  useEffect(() => {
    const onPopState = () => {
      const next = getInitialRoute();
      setView(next.view);
      setStatusSlipCode(next.slipCode);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const openOrderStatusPage = (code = '') => {
    const cleaned = normalizeClaimSlip(code);
    setStatusSlipCode(cleaned);
    setView('status');
    const url = cleaned
      ? `${window.location.pathname}?track=${encodeURIComponent(cleaned)}`
      : `${window.location.pathname}?track=`;
    window.history.pushState({}, '', url);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const updateOrderStatusUrl = (code: string) => {
    const cleaned = normalizeClaimSlip(code);
    setStatusSlipCode(cleaned);
    const url = cleaned
      ? `${window.location.pathname}?track=${encodeURIComponent(cleaned)}`
      : `${window.location.pathname}?track=`;
    window.history.replaceState({}, '', url);
  };

  const navigateToHome = (sectionHash?: string) => {
    setView('public');
    const targetUrl = sectionHash
      ? `${window.location.pathname}#${sectionHash}`
      : window.location.pathname;
    window.history.pushState({}, '', targetUrl);
    if (sectionHash) {
      setTimeout(() => {
        document.getElementById(sectionHash)?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Publicly readable catalog & shop policies
  useEffect(() => {
    const unsubServices = onSnapshot(
      query(collection(db, 'services'), orderBy('name', 'asc')),
      (snap) => {
        if (!snap.empty) {
          setServicesEmptyInDb(false);
          setServices(
            snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<ServiceRate, 'id'>),
            }))
          );
        } else {
          setServicesEmptyInDb(true);
          setServices(DEFAULT_SERVICES);
        }
      },
      (err) => {
        console.warn('Services read fallback:', err);
      }
    );

    const unsubSettings = onSnapshot(
      doc(db, 'shopSettings', 'main'),
      (snap) => {
        if (snap.exists()) {
          setShopSettings(snap.data() as ShopSettings);
        } else {
          setShopSettings(DEFAULT_SHOP_SETTINGS);
        }
      },
      (err) => {
        console.warn('Settings read fallback:', err);
      }
    );

    return () => {
      unsubServices();
      unsubSettings();
    };
  }, []);

  // Ensure default Nazareth service rates exist in Firestore once Owner signs in
  useEffect(() => {
    if (
      userAccount?.role === 'owner' &&
      userAccount.active &&
      servicesEmptyInDb &&
      !catalogBootstrapped
    ) {
      setCatalogBootstrapped(true);
      void bootstrapCatalogIfEmpty();
    }
  }, [userAccount, servicesEmptyInDb, catalogBootstrapped]);

  // Auth state + real-time user RBAC document watcher
  useEffect(() => {
    let unsubUserDoc: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubUserDoc) {
        unsubUserDoc();
        unsubUserDoc = null;
      }

      setFirebaseUser(user);
      if (!user) {
        setUserAccount(null);
        setAuthReady(true);
        return;
      }

      try {
        const ensured = await ensureUserAccount(user);
        setUserAccount(ensured);
        unsubUserDoc = onSnapshot(
          doc(db, 'users', user.uid),
          (snap) => {
            if (snap.exists()) {
              setUserAccount({
                id: snap.id,
                ...(snap.data() as Omit<UserAccount, 'id'>),
              });
            }
          },
          (err) => handleFirestoreError(err, OperationType.GET, `users/${user.uid}`)
        );
      } catch (err) {
        setAuthError(
          err instanceof Error ? err.message : 'Unable to load account role.'
        );
      } finally {
        setAuthReady(true);
      }
    });

    return () => {
      unsubAuth();
      if (unsubUserDoc) unsubUserDoc();
    };
  }, []);

  const isAuthorizedStaff = Boolean(
    userAccount &&
      userAccount.active &&
      (userAccount.role === 'owner' || userAccount.role === 'staff')
  );

  const handleGoogleSignIn = async () => {
    setAuthError('');
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Google sign-in was cancelled or blocked.'
      );
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    setView('public');
  };

  // Dedicated Order Status Page
  if (view === 'status') {
    return (
      <OrderStatusPage
        initialClaimSlip={statusSlipCode}
        shopSettings={shopSettings}
        isAuthenticatedStaff={isAuthorizedStaff}
        onNavigateHome={navigateToHome}
        onOpenPortal={() => setView('portal')}
        onClaimSlipChange={updateOrderStatusUrl}
      />
    );
  }

  // Public Website & Customer Storefront
  if (view === 'public') {
    return (
      <PublicStorefront
        services={services}
        shopSettings={shopSettings}
        isAuthenticatedStaff={isAuthorizedStaff}
        onOpenPortal={() => setView('portal')}
        onOpenOrderStatus={openOrderStatusPage}
      />
    );
  }

  // Staff / Owner Portal Gate
  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <p className="font-display text-lg font-bold text-slate-900">YouLaba</p>
          <p className="text-xs text-slate-500">Checking counter session...</p>
        </div>
      </div>
    );
  }

  if (!firebaseUser || !userAccount) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8 space-y-6">
          <div>
            <button
              type="button"
              onClick={() => setView('public')}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 mb-5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to YouLaba Website
            </button>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900">
              YouLaba Staff & Owner Portal
            </h1>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              Sign in with your verified Google account to access order intake, claim slip printing, status tracking, and MIS sales reports for the Nazareth branch.
            </p>
          </div>

          {authError && (
            <p className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
              {authError}
            </p>
          )}

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={signingIn}
            className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-3 text-sm font-semibold text-white bg-[#0B6E99] hover:bg-[#085A7E] disabled:opacity-60 rounded-lg transition-colors"
          >
            <LogIn className="w-4 h-4" />
            {signingIn ? 'Opening Google Sign-In...' : 'Sign In with Google'}
          </button>

          <div className="pt-4 border-t border-slate-100 flex items-start gap-2.5 text-[11px] text-slate-500 leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-[#0B6E99] shrink-0 mt-0.5" />
            <span>
              Role-based access control protects customer phone numbers and daily financial ledgers. First-time staff logins require Owner approval.
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Signed in, but waiting for Shop Owner approval (RBAC security guard)
  if (!isAuthorizedStaff) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8 space-y-5">
          <div className="flex items-center gap-3 text-amber-700">
            <Clock className="w-6 h-6 shrink-0" />
            <h1 className="font-display text-xl font-bold text-slate-900">
              Awaiting Shop Owner Approval
            </h1>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Your account (<span className="font-mono font-semibold text-slate-900">{userAccount.email}</span>) is registered as <strong>Pending</strong>. Ask the YouLaba Shop Owner to approve your role under <strong>Team & Audit Trail</strong> before accessing counter records.
          </p>
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setView('public')}
              className="flex-1 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg"
            >
              Back to Public Site
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated & Approved Owner or Staff Attendant Workspace
  return (
    <WorkspaceApp
      currentUser={userAccount}
      services={services}
      shopSettings={shopSettings}
      onBackToWebsite={() => setView('public')}
      onSignOut={handleSignOut}
    />
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <YouLabaApp />
    </ErrorBoundary>
  );
}

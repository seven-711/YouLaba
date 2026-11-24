import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    let friendly = error.message || 'An unexpected application error occurred.';
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && parsed.error) {
        if (String(parsed.error).includes('Quota exceeded')) {
          friendly =
            'Daily Firestore quota has been reached. Quota resets tomorrow, or you can upgrade the project plan in Firebase Console.';
        } else if (String(parsed.error).includes('permission') || String(parsed.error).includes('PERMISSION_DENIED')) {
          friendly = `Access denied for ${parsed.operationType || 'operation'} on ${parsed.path || 'record'}. Ensure your account is approved as active Staff or Owner.`;
        } else {
          friendly = parsed.error;
        }
      }
    } catch {
      // Plain text error
    }
    return { hasError: true, message: friendly };
  }

  componentDidCatch(error: Error) {
    console.error('YouLaba ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-8">
            <div className="flex items-center gap-3 text-red-700 mb-4">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h2 className="text-lg font-bold tracking-tight text-slate-900">
                Something interrupted the counter view
              </h2>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.reload();
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#0B6E99] hover:bg-[#085A7E] rounded-lg transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4" />
              Reload YouLaba
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

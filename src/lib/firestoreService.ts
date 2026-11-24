import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  BOOTSTRAP_OWNER_EMAIL,
  computeEstimatedClaimIso,
  computeOrderPrice,
  DEFAULT_SERVICES,
  DEFAULT_SHOP_SETTINGS,
  maskCustomerLabel,
  normalizeClaimSlip,
  sanitizeStr,
  type Customer,
  type DailyReconciliation,
  type FeedbackCategory,
  type FeedbackStatus,
  type LaundryOrder,
  type OrderStatus,
  type OrderTrackingPublic,
  type PaidMethod,
  type PaymentMethod,
  type PaymentStatus,
  type ServiceRate,
  type ShopSettings,
  type UserAccount,
  type UserRole,
} from '../types/youlaba';

function makeDocId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`;
}

export async function ensureUserAccount(firebaseUser: User): Promise<UserAccount> {
  const ref = doc(db, 'users', firebaseUser.uid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data() as Omit<UserAccount, 'id'>;
      return { id: snap.id, ...data };
    }

    const isBootstrap =
      firebaseUser.emailVerified &&
      (firebaseUser.email || '').toLowerCase() === BOOTSTRAP_OWNER_EMAIL.toLowerCase();

    const payload = {
      uid: firebaseUser.uid,
      email: sanitizeStr(firebaseUser.email || '', 160),
      displayName: sanitizeStr(
        firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Team Member',
        100
      ),
      role: (isBootstrap ? 'owner' : 'pending') as UserRole,
      active: isBootstrap,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(ref, payload);
    return {
      id: firebaseUser.uid,
      uid: payload.uid,
      email: payload.email,
      displayName: payload.displayName,
      role: payload.role,
      active: payload.active,
      createdAt: null,
      updatedAt: null,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${firebaseUser.uid}`);
  }
}

export async function lookupPublicOrderTracking(
  rawClaimSlip: string
): Promise<OrderTrackingPublic | null> {
  const code = normalizeClaimSlip(rawClaimSlip);
  if (code.length < 5) return null;
  const path = `orderTracking/${code}`;
  try {
    const snap = await getDoc(doc(db, 'orderTracking', code));
    if (!snap.exists()) return null;
    return snap.data() as OrderTrackingPublic;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function submitPublicFeedback(input: {
  authorName: string;
  authorRole: 'customer' | 'staff';
  claimSlipNumber: string;
  rating: number;
  category: FeedbackCategory;
  message: string;
}): Promise<string> {
  const id = makeDocId('fb');
  const path = `feedback/${id}`;
  try {
    await setDoc(doc(db, 'feedback', id), {
      authorName: sanitizeStr(input.authorName, 80),
      authorRole: input.authorRole,
      claimSlipNumber: normalizeClaimSlip(input.claimSlipNumber),
      rating: Math.min(5, Math.max(1, Math.round(input.rating))),
      category: input.category,
      message: sanitizeStr(input.message, 500),
      status: 'Open',
      createdAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateFeedbackStatus(feedbackId: string, status: FeedbackStatus) {
  const path = `feedback/${feedbackId}`;
  try {
    await updateDoc(doc(db, 'feedback', feedbackId), { status });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveServiceRate(
  service: Omit<ServiceRate, 'id' | 'updatedAt'> & { id?: string }
) {
  const id = service.id || makeDocId('svc');
  const path = `services/${id}`;
  try {
    await setDoc(doc(db, 'services', id), {
      name: sanitizeStr(service.name, 80),
      description: sanitizeStr(service.description, 260),
      pricingUnit: service.pricingUnit,
      rate: Number(service.rate),
      minQuantity: Number(service.minQuantity),
      turnaroundHours: Number(service.turnaroundHours),
      category: service.category,
      active: Boolean(service.active),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteServiceRate(serviceId: string) {
  const path = `services/${serviceId}`;
  try {
    await deleteDoc(doc(db, 'services', serviceId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveShopSettings(settings: ShopSettings) {
  const path = 'shopSettings/main';
  try {
    await setDoc(doc(db, 'shopSettings', 'main'), {
      shopName: sanitizeStr(settings.shopName, 80),
      branchAddress: sanitizeStr(settings.branchAddress, 200),
      contactPhone: sanitizeStr(settings.contactPhone, 40),
      operatingHours: sanitizeStr(settings.operatingHours, 120),
      defaultTurnaroundHours: Number(settings.defaultTurnaroundHours),
      unclaimedAlertHours: Number(settings.unclaimedAlertHours),
      activePromoCode: sanitizeStr(settings.activePromoCode.toUpperCase(), 32),
      activePromoPercent: Math.min(100, Math.max(0, Number(settings.activePromoPercent))),
      activePromoLabel: sanitizeStr(settings.activePromoLabel, 120),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveCustomer(
  customer: { id?: string; fullName: string; contactNumber: string; notes: string; totalOrders?: number },
  actorUid: string
): Promise<string> {
  const isNew = !customer.id;
  const id = customer.id || makeDocId('cust');
  const path = `customers/${id}`;
  try {
    if (isNew) {
      await setDoc(doc(db, 'customers', id), {
        fullName: sanitizeStr(customer.fullName, 100),
        contactNumber: sanitizeStr(customer.contactNumber, 20),
        notes: sanitizeStr(customer.notes, 250),
        totalOrders: customer.totalOrders ?? 0,
        createdByUid: actorUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'customers', id), {
        fullName: sanitizeStr(customer.fullName, 100),
        contactNumber: sanitizeStr(customer.contactNumber, 20),
        notes: sanitizeStr(customer.notes, 250),
        updatedAt: serverTimestamp(),
      });
    }
    return id;
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export interface CreateOrderInput {
  claimSlipNumber: string;
  existingCustomer?: Customer | null;
  customerName: string;
  customerPhone: string;
  customerNotes: string;
  service: ServiceRate;
  quantity: number;
  bagCount: number;
  itemsSummary: string;
  specialInstructions: string;
  discountAmount: number;
  promoCode: string;
  payNow: boolean;
  paymentMethod: PaidMethod;
  amountTendered: number;
  actor: { uid: string; name: string; role: 'owner' | 'staff' };
}

export async function createLaundryOrderAtomic(input: CreateOrderInput): Promise<LaundryOrder> {
  const batch = writeBatch(db);
  const now = new Date();
  const dropOffAt = now.toISOString();
  const estimatedClaimAt = computeEstimatedClaimIso(now, input.service.turnaroundHours);
  const claimSlipNumber = normalizeClaimSlip(input.claimSlipNumber);

  const { subtotal, discount, total } = computeOrderPrice(
    input.service.rate,
    input.quantity,
    input.service.minQuantity,
    input.discountAmount
  );

  let customerId = input.existingCustomer?.id || makeDocId('cust');
  const cleanName = sanitizeStr(input.customerName, 100);
  const cleanPhone = sanitizeStr(input.customerPhone, 20);
  const cleanCustomerNotes = sanitizeStr(input.customerNotes, 250);

  if (input.existingCustomer) {
    batch.update(doc(db, 'customers', customerId), {
      fullName: cleanName,
      contactNumber: cleanPhone,
      notes: cleanCustomerNotes,
      totalOrders: (input.existingCustomer.totalOrders || 0) + 1,
      updatedAt: serverTimestamp(),
    });
  } else {
    batch.set(doc(db, 'customers', customerId), {
      fullName: cleanName,
      contactNumber: cleanPhone,
      notes: cleanCustomerNotes,
      totalOrders: 1,
      createdByUid: input.actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  const orderId = makeDocId('ord');
  const paymentStatus: PaymentStatus = input.payNow && total > 0 ? 'Paid' : total === 0 ? 'Paid' : 'Unpaid';
  const amountPaid = input.payNow ? total : 0;
  const paymentMethod: PaymentMethod = input.payNow ? input.paymentMethod : 'None';

  const orderData = {
    claimSlipNumber,
    customerId,
    customerName: cleanName,
    customerPhone: cleanPhone,
    serviceId: input.service.id,
    serviceName: sanitizeStr(input.service.name, 80),
    pricingUnit: input.service.pricingUnit,
    unitRate: input.service.rate,
    quantity: Number(input.quantity),
    bagCount: Math.max(1, Math.round(input.bagCount)),
    itemsSummary: sanitizeStr(input.itemsSummary, 300),
    specialInstructions: sanitizeStr(input.specialInstructions, 300),
    subtotal,
    discountAmount: discount,
    promoCode: sanitizeStr(input.promoCode.toUpperCase(), 32),
    totalPrice: total,
    status: 'Received' as OrderStatus,
    paymentStatus,
    amountPaid,
    paymentMethod,
    dropOffAt,
    estimatedClaimAt,
    claimedAt: '',
    createdByUid: input.actor.uid,
    createdByName: sanitizeStr(input.actor.name, 100),
    updatedByUid: input.actor.uid,
    updatedByName: sanitizeStr(input.actor.name, 100),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  batch.set(doc(db, 'orders', orderId), orderData);

  // PII-isolated public tracking document
  batch.set(doc(db, 'orderTracking', claimSlipNumber), {
    claimSlipNumber,
    customerLabel: maskCustomerLabel(cleanName),
    serviceName: orderData.serviceName,
    pricingUnit: orderData.pricingUnit,
    quantity: orderData.quantity,
    bagCount: orderData.bagCount,
    totalPrice: orderData.totalPrice,
    paymentStatus: orderData.paymentStatus,
    status: orderData.status,
    dropOffAt,
    estimatedClaimAt,
    claimedAt: '',
    updatedAt: serverTimestamp(),
  });

  // Initial immutable audit trail log
  const logId = makeDocId('log');
  batch.set(doc(db, 'statusLogs', logId), {
    orderId,
    claimSlipNumber,
    action: 'ORDER_CREATED',
    fromStatus: '',
    toStatus: 'Received',
    note: sanitizeStr(
      `Drop-off intake: ${input.quantity} ${input.service.pricingUnit} (${orderData.bagCount} bag${orderData.bagCount > 1 ? 's' : ''})`,
      240
    ),
    actorUid: input.actor.uid,
    actorName: sanitizeStr(input.actor.name, 100),
    actorRole: input.actor.role,
    createdAt: serverTimestamp(),
  });

  if (input.payNow && total > 0) {
    const payId = makeDocId('pay');
    const tendered = Math.max(total, Number(input.amountTendered) || total);
    const changeGiven = Math.max(0, Math.round((tendered - total) * 100) / 100);
    batch.set(doc(db, 'payments', payId), {
      orderId,
      claimSlipNumber,
      amount: total,
      amountTendered: tendered,
      changeGiven,
      method: input.paymentMethod,
      notes: 'Paid upon drop-off',
      recordedByUid: input.actor.uid,
      recordedByName: sanitizeStr(input.actor.name, 100),
      createdAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
    return {
      id: orderId,
      ...orderData,
      createdAt: null,
      updatedAt: null,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `orders/${orderId}`);
  }
}

export async function updateOrderStatusAtomic(params: {
  order: LaundryOrder;
  nextStatus: OrderStatus;
  note: string;
  actor: { uid: string; name: string; role: 'owner' | 'staff' };
}) {
  const { order, nextStatus, note, actor } = params;
  const batch = writeBatch(db);
  const claimedAt =
    nextStatus === 'Claimed' ? new Date().toISOString() : order.claimedAt || '';

  batch.update(doc(db, 'orders', order.id), {
    status: nextStatus,
    claimedAt,
    updatedByUid: actor.uid,
    updatedByName: sanitizeStr(actor.name, 100),
    updatedAt: serverTimestamp(),
  });

  batch.update(doc(db, 'orderTracking', order.claimSlipNumber), {
    status: nextStatus,
    claimedAt,
    updatedAt: serverTimestamp(),
  });

  const logId = makeDocId('log');
  batch.set(doc(db, 'statusLogs', logId), {
    orderId: order.id,
    claimSlipNumber: order.claimSlipNumber,
    action: nextStatus === 'Claimed' ? 'ORDER_CLAIMED' : 'STATUS_UPDATED',
    fromStatus: order.status,
    toStatus: nextStatus,
    note: sanitizeStr(note || `Moved from ${order.status} to ${nextStatus}`, 240),
    actorUid: actor.uid,
    actorName: sanitizeStr(actor.name, 100),
    actorRole: actor.role,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `orders/${order.id}`);
  }
}

export async function recordOrderPaymentAtomic(params: {
  order: LaundryOrder;
  paymentAmount: number;
  amountTendered: number;
  method: PaidMethod;
  notes: string;
  alsoMarkClaimed: boolean;
  actor: { uid: string; name: string; role: 'owner' | 'staff' };
}) {
  const { order, paymentAmount, amountTendered, method, notes, alsoMarkClaimed, actor } = params;
  const batch = writeBatch(db);

  const safePayAmount = Math.round(Math.max(0.01, paymentAmount) * 100) / 100;
  const safeTendered = Math.round(Math.max(safePayAmount, amountTendered) * 100) / 100;
  const changeGiven = Math.max(0, Math.round((safeTendered - safePayAmount) * 100) / 100);

  const newAmountPaid = Math.min(
    order.totalPrice,
    Math.round((order.amountPaid + safePayAmount) * 100) / 100
  );
  const newPaymentStatus: PaymentStatus =
    newAmountPaid >= order.totalPrice - 0.01 ? 'Paid' : newAmountPaid > 0 ? 'Partial' : 'Unpaid';

  const nextStatus: OrderStatus = alsoMarkClaimed ? 'Claimed' : order.status;
  const claimedAt = alsoMarkClaimed ? new Date().toISOString() : order.claimedAt || '';

  const orderUpdate: Record<string, unknown> = {
    paymentStatus: newPaymentStatus,
    amountPaid: newAmountPaid,
    paymentMethod: method,
    updatedByUid: actor.uid,
    updatedByName: sanitizeStr(actor.name, 100),
    updatedAt: serverTimestamp(),
  };
  if (alsoMarkClaimed) {
    orderUpdate.status = 'Claimed';
    orderUpdate.claimedAt = claimedAt;
  }

  batch.update(doc(db, 'orders', order.id), orderUpdate);

  const trackUpdate: Record<string, unknown> = {
    paymentStatus: newPaymentStatus,
    updatedAt: serverTimestamp(),
  };
  if (alsoMarkClaimed) {
    trackUpdate.status = 'Claimed';
    trackUpdate.claimedAt = claimedAt;
  }
  batch.update(doc(db, 'orderTracking', order.claimSlipNumber), trackUpdate);

  const payId = makeDocId('pay');
  batch.set(doc(db, 'payments', payId), {
    orderId: order.id,
    claimSlipNumber: order.claimSlipNumber,
    amount: safePayAmount,
    amountTendered: safeTendered,
    changeGiven,
    method,
    notes: sanitizeStr(notes, 200),
    recordedByUid: actor.uid,
    recordedByName: sanitizeStr(actor.name, 100),
    createdAt: serverTimestamp(),
  });

  const logId = makeDocId('log');
  batch.set(doc(db, 'statusLogs', logId), {
    orderId: order.id,
    claimSlipNumber: order.claimSlipNumber,
    action: alsoMarkClaimed ? 'ORDER_CLAIMED' : 'PAYMENT_RECORDED',
    fromStatus: order.status,
    toStatus: nextStatus,
    note: sanitizeStr(
      `Payment ₱${safePayAmount.toFixed(2)} via ${method}${alsoMarkClaimed ? ' & released to customer' : ''}`,
      240
    ),
    actorUid: actor.uid,
    actorName: sanitizeStr(actor.name, 100),
    actorRole: actor.role,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `orders/${order.id}`);
  }
}

export async function updateUserRoleAndStatus(
  userId: string,
  updates: { role: UserRole; active: boolean }
) {
  const path = `users/${userId}`;
  try {
    await updateDoc(doc(db, 'users', userId), {
      role: updates.role,
      active: updates.active,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveDailyReconciliation(
  rec: Omit<DailyReconciliation, 'id' | 'createdAt'>
) {
  const id = `rec-${rec.dateKey}`;
  const path = `dailyReconciliations/${id}`;
  const ref = doc(db, 'dailyReconciliations', id);
  const fields = {
    systemCashTotal: Number(rec.systemCashTotal),
    actualCashCounted: Number(rec.actualCashCounted),
    cashVariance: Math.round((rec.actualCashCounted - rec.systemCashTotal) * 100) / 100,
    systemBagCount: Number(rec.systemBagCount),
    actualBagCount: Number(rec.actualBagCount),
    bagVariance: Math.round(rec.actualBagCount - rec.systemBagCount),
    notes: sanitizeStr(rec.notes, 300),
    checkedByUid: rec.checkedByUid,
    checkedByName: sanitizeStr(rec.checkedByName, 100),
  };

  try {
    const existingSnap = await getDoc(ref);
    if (existingSnap.exists()) {
      await updateDoc(ref, fields);
    } else {
      await setDoc(ref, {
        dateKey: rec.dateKey,
        ...fields,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function bootstrapCatalogIfEmpty() {
  const batch = writeBatch(db);
  batch.set(doc(db, 'shopSettings', 'main'), {
    ...DEFAULT_SHOP_SETTINGS,
    updatedAt: serverTimestamp(),
  });
  for (const svc of DEFAULT_SERVICES) {
    const { id, ...rest } = svc;
    batch.set(doc(db, 'services', id), {
      ...rest,
      updatedAt: serverTimestamp(),
    });
  }
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'bootstrap-catalog');
  }
}

/**
 * Owner UAT Bootstrapper: seeds default YouLaba Nazareth CDO services, shop settings,
 * and realistic starter orders (across multiple stages) so the owner and staff
 * can immediately verify the end-to-end TPS, Claim Slip, Public Tracker, and MIS reports.
 */
export async function seedInitialYouLabaData(actor: {
  uid: string;
  name: string;
  role: 'owner' | 'staff';
}) {
  const batch = writeBatch(db);

  // 1. Seed shop settings
  batch.set(doc(db, 'shopSettings', 'main'), {
    ...DEFAULT_SHOP_SETTINGS,
    updatedAt: serverTimestamp(),
  });

  // 2. Seed services
  for (const svc of DEFAULT_SERVICES) {
    const { id, ...rest } = svc;
    batch.set(doc(db, 'services', id), {
      ...rest,
      updatedAt: serverTimestamp(),
    });
  }

  // 3. Seed realistic Nazareth CDO customers & orders
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const year = new Date().getFullYear();

  const starterCustomers = [
    { id: 'cust-seed-1', fullName: 'Maricel Villanueva', contactNumber: '0917-821-4432', notes: 'Prefers mild baby-safe fabric softener' },
    { id: 'cust-seed-2', fullName: 'Jerome Pagaspas', contactNumber: '0926-412-9081', notes: 'Capitol University student - dormitory weekly drop-off' },
    { id: 'cust-seed-3', fullName: 'Clarissa Lim', contactNumber: '0918-903-2215', notes: 'Separate whites and office blouses' },
    { id: 'cust-seed-4', fullName: 'Rodelio Cabanlit', contactNumber: '0905-671-3340', notes: 'Nazareth 12th St resident' },
  ];

  for (const c of starterCustomers) {
    batch.set(doc(db, 'customers', c.id), {
      fullName: c.fullName,
      contactNumber: c.contactNumber,
      notes: c.notes,
      totalOrders: 1,
      createdByUid: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  const starterOrders: Array<{
    id: string;
    slip: string;
    customer: (typeof starterCustomers)[number];
    service: (typeof DEFAULT_SERVICES)[number];
    qty: number;
    bags: number;
    items: string;
    instructions: string;
    status: OrderStatus;
    payStatus: PaymentStatus;
    payMethod: PaymentMethod;
    dropOffsetHrs: number;
    claimedOffsetHrs?: number;
  }> = [
    {
      id: 'ord-seed-1',
      slip: `YL-${year}-0001`,
      customer: starterCustomers[0],
      service: DEFAULT_SERVICES[0],
      qty: 6.5,
      bags: 2,
      items: 'Everyday tees, denim jeans, bath towels, pillowcases',
      instructions: 'Low heat tumble dry for cotton shirts',
      status: 'Washing',
      payStatus: 'Paid',
      payMethod: 'Cash',
      dropOffsetHrs: -3,
    },
    {
      id: 'ord-seed-2',
      slip: `YL-${year}-0002`,
      customer: starterCustomers[1],
      service: DEFAULT_SERVICES[1],
      qty: 4,
      bags: 1,
      items: 'School uniforms, polo shirts, socks, athletic shorts',
      instructions: 'Needs before 6 PM class',
      status: 'Ready for Pickup',
      payStatus: 'Unpaid',
      payMethod: 'None',
      dropOffsetHrs: -7,
    },
    {
      id: 'ord-seed-3',
      slip: `YL-${year}-0003`,
      customer: starterCustomers[2],
      service: DEFAULT_SERVICES[2],
      qty: 3.5,
      bags: 1,
      items: '5 white office blouses, 3 slacks, 2 blazers',
      instructions: 'Fold neatly with tissue paper between whites',
      status: 'Folding/Ironing',
      payStatus: 'Paid',
      payMethod: 'GCash',
      dropOffsetHrs: -18,
    },
    {
      id: 'ord-seed-4',
      slip: `YL-${year}-0004`,
      customer: starterCustomers[3],
      service: DEFAULT_SERVICES[3],
      qty: 1,
      bags: 1,
      items: 'Queen-size quilted comforter and 2 bedsheets',
      instructions: 'Extra rinse cycle',
      status: 'Claimed',
      payStatus: 'Paid',
      payMethod: 'Cash',
      dropOffsetHrs: -54,
      claimedOffsetHrs: -4,
    },
  ];

  for (const item of starterOrders) {
    const dropDate = new Date(now + item.dropOffsetHrs * hour);
    const estClaimIso = computeEstimatedClaimIso(dropDate, item.service.turnaroundHours);
    const claimedIso = item.claimedOffsetHrs
      ? new Date(now + item.claimedOffsetHrs * hour).toISOString()
      : '';
    const { subtotal, total } = computeOrderPrice(
      item.service.rate,
      item.qty,
      item.service.minQuantity,
      0
    );
    const paidAmt = item.payStatus === 'Paid' ? total : 0;

    batch.set(doc(db, 'orders', item.id), {
      claimSlipNumber: item.slip,
      customerId: item.customer.id,
      customerName: item.customer.fullName,
      customerPhone: item.customer.contactNumber,
      serviceId: item.service.id,
      serviceName: item.service.name,
      pricingUnit: item.service.pricingUnit,
      unitRate: item.service.rate,
      quantity: item.qty,
      bagCount: item.bags,
      itemsSummary: item.items,
      specialInstructions: item.instructions,
      subtotal,
      discountAmount: 0,
      promoCode: '',
      totalPrice: total,
      status: item.status,
      paymentStatus: item.payStatus,
      amountPaid: paidAmt,
      paymentMethod: item.payMethod,
      dropOffAt: dropDate.toISOString(),
      estimatedClaimAt: estClaimIso,
      claimedAt: claimedIso,
      createdByUid: actor.uid,
      createdByName: actor.name,
      updatedByUid: actor.uid,
      updatedByName: actor.name,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'orderTracking', item.slip), {
      claimSlipNumber: item.slip,
      customerLabel: maskCustomerLabel(item.customer.fullName),
      serviceName: item.service.name,
      pricingUnit: item.service.pricingUnit,
      quantity: item.qty,
      bagCount: item.bags,
      totalPrice: total,
      paymentStatus: item.payStatus,
      status: item.status,
      dropOffAt: dropDate.toISOString(),
      estimatedClaimAt: estClaimIso,
      claimedAt: claimedIso,
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'statusLogs', `log-${item.id}`), {
      orderId: item.id,
      claimSlipNumber: item.slip,
      action: 'ORDER_CREATED',
      fromStatus: '',
      toStatus: item.status,
      note: 'Sample UAT order initialized for Nazareth branch',
      actorUid: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      createdAt: serverTimestamp(),
    });

    if (item.payStatus === 'Paid' && item.payMethod !== 'None') {
      batch.set(doc(db, 'payments', `pay-${item.id}`), {
        orderId: item.id,
        claimSlipNumber: item.slip,
        amount: total,
        amountTendered: total,
        changeGiven: 0,
        method: item.payMethod,
        notes: 'Sample UAT payment',
        recordedByUid: actor.uid,
        recordedByName: actor.name,
        createdAt: serverTimestamp(),
      });
    }
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'batch-seed-youlaba');
  }
}

export { collection, doc };

# YouLaba Security Specification (Phase 0: Payload-First Security TDD)

## 1. Data Invariants
1. **Bootstrapped Owner & Verified Email Mandate**: Every privileged read/write requires `request.auth != null && request.auth.token.email_verified == true`. Only the bootstrapped owner (`claridadjulyfranz@gmail.com`) or an owner-approved active `users/{uid}` document (`role in ['owner', 'staff'] && active == true`) can access internal TPS/MIS collections.
2. **No Self-Assigned Roles**: Non-bootstrapped users creating `/users/{uid}` may ONLY create `role == 'pending'` and `active == false`. Only `isOwner()` may elevate `role` or toggle `active`.
3. **PII Isolation (Data Privacy Act of 2012)**: Customer phone numbers and full personal records live exclusively in `/customers/{customerId}` and `/orders/{orderId}` (restricted strictly to verified Owner/Staff). Public order tracking reads `/orderTracking/{claimSlipNumber}` via `get` ONLY (`allow list: if false;` for public) with masked `customerLabel` and zero phone/email fields.
4. **Relational Integrity**: Every `/orders/{orderId}` creation verifies that `customerId` and `serviceId` exist and that `orderTracking/{claimSlipNumber}` exists atomically (`existsAfter`) in the same write batch. Every `/payments/{paymentId}` and `/statusLogs/{logId}` verifies that `orderId` exists (or `existsAfter` during order creation batch).
5. **Terminal State Locking**: Once an order reaches `status == 'Claimed'`, regular staff can no longer modify it; only `isOwner()` can execute an override correction.
6. **Immutable Audit & Payment Ledgers**: `/payments/{paymentId}` and `/statusLogs/{logId}` are append-only (`allow update, delete: if false;`) to preserve full financial and operational accountability.
7. **Temporal & Volumetric Integrity**: All `createdAt` / `updatedAt` timestamps on authenticated writes enforce `== request.time`. Every string field enforces strict `.size()` bounds, and every document ID enforces `isValidId()`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Self-Role Escalation**: Unprivileged user attempts `setDoc(/users/{uid}, { role: 'owner', active: true, ... })`. -> Expected: `PERMISSION_DENIED`.
2. **Unverified Email Spoofing**: Token with `email: 'claridadjulyfranz@gmail.com'` and `email_verified: false` attempts reading `/orders`. -> Expected: `PERMISSION_DENIED`.
3. **Public PII Scraping**: Anonymous client attempts `getDocs(collection(db, 'customers'))` or `getDocs(collection(db, 'orders'))`. -> Expected: `PERMISSION_DENIED`.
4. **Public Tracking Enumeration**: Anonymous client attempts `getDocs(collection(db, 'orderTracking'))` (`list`). -> Expected: `PERMISSION_DENIED`.
5. **Shadow Ghost Field Injection**: Staff attempts updating `/orders/{id}` with an extra field `{ isFree: true }` alongside status update. -> Expected: `PERMISSION_DENIED`.
6. **Orphaned Order Without Public Tracker**: Staff creates `/orders/{id}` without atomically writing `/orderTracking/{claimSlipNumber}` in the same batch. -> Expected: `PERMISSION_DENIED`.
7. **Terminal State Mutation**: Regular staff attempts changing status of a `'Claimed'` order back to `'Washing'`. -> Expected: `PERMISSION_DENIED`.
8. **Audit Trail Tampering**: Staff or Owner attempts updating or deleting a `/statusLogs/{logId}` document. -> Expected: `PERMISSION_DENIED`.
9. **Payment Ledger Tampering**: Staff attempts editing an existing `/payments/{paymentId}` amount after recording. -> Expected: `PERMISSION_DENIED`.
10. **ID Poisoning / Oversized Payload**: Client attempts creating `/feedback/{id}` with a 500-character ID or a 5,000-character message. -> Expected: `PERMISSION_DENIED`.
11. **Identity Spoofing on Order Creation**: Staff creates `/orders/{id}` with `createdByUid` set to another staff member's UID. -> Expected: `PERMISSION_DENIED`.
12. **Client Timestamp Backdating**: Staff creates `/orders/{id}` with a forged `createdAt` timestamp instead of `serverTimestamp()`. -> Expected: `PERMISSION_DENIED`.

# Security Specification (Payload-First TDD)

## 1. Data Invariants

1. **Strict Account Isolation**: Every `UserProfile` (`/users/{userId}`) and `Transaction` (`/users/{userId}/transactions/{transactionId}`) belongs exclusively to the authenticated user whose `request.auth.uid == userId`. No user can read, list, create, update, or delete another user's profile or transactions.
2. **No Collection Enumeration**: Listing `/users` is strictly denied (`allow list: if false`). Listing `/users/{userId}/transactions` requires `request.auth.uid == userId` and `resource.data.userId == request.auth.uid`.
3. **Parent Integrity (Master Gate)**: A transaction under `/users/{userId}/transactions/{transactionId}` can only be created or updated if the parent `/users/{userId}` document exists and its `uid` matches `request.auth.uid`, and `incoming().userId == request.auth.uid`.
4. **Immutable Identity & Temporal Integrity**: `uid` / `userId`, `email`, and `createdAt` cannot be modified after creation. `createdAt` must equal `request.time` on create, and `updatedAt` must equal `request.time` on create and update.
5. **Strict Key & Volumetric Boundaries**: No shadow/ghost keys are permitted (`hasOnly` + `affectedKeys().hasOnly()`). Amounts must be positive (for transactions) or non-negative (for budgets) and bounded. Strings have explicit `size()` limits matching `firebase-blueprint.json`.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Cross-User Profile Read**: User B (`uid: "userB"`) attempts `get(/users/userA)` -> `PERMISSION_DENIED`.
2. **User Directory Scraping**: User A attempts `list(/users)` -> `PERMISSION_DENIED`.
3. **UID Spoofing on Profile Create**: User A attempts `create(/users/userA)` with `{ uid: "userB", ... }` -> `PERMISSION_DENIED`.
4. **Shadow Field Injection on Profile Create**: User A attempts `create(/users/userA)` with extra key `{ ..., isAdmin: true }` -> `PERMISSION_DENIED`.
5. **Fake Timestamp on Profile Create**: User A attempts `create(/users/userA)` with client-supplied `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time` -> `PERMISSION_DENIED`.
6. **Immutable UID Mutation on Profile Update**: User A attempts `update(/users/userA)` changing `uid` -> `PERMISSION_DENIED`.
7. **Negative Monthly Budget**: User A attempts `update(/users/userA)` with `monthlyBudget: -50000` -> `PERMISSION_DENIED`.
8. **Cross-User Transaction Read/List**: User B attempts `list(/users/userA/transactions)` -> `PERMISSION_DENIED`.
9. **Orphan Transaction Without Parent Profile**: User A attempts `create(/users/userA/transactions/tx1)` before `/users/userA` exists -> `PERMISSION_DENIED`.
10. **Zero or Negative Transaction Amount**: User A attempts `create(/users/userA/transactions/tx1)` with `amount: 0` or `-100` -> `PERMISSION_DENIED`.
11. **Oversized Description / Resource Poisoning**: User A attempts `create(/users/userA/transactions/tx1)` with 10,000-char `description` or invalid `transactionId` containing spaces/symbols -> `PERMISSION_DENIED`.
12. **Ghost Field on Transaction Update**: User A attempts `update(/users/userA/transactions/tx1)` including unexpected field `verifiedByBank: true` -> `PERMISSION_DENIED`.

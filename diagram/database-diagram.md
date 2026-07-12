# ZendaFund Database Diagram

## Overview
This diagram shows the main MongoDB collections and how data moves between them in ZendaFund.

- `users` stores person accounts and roles.
- `campaigns` stores campaign details created by creators.
- `contributions` stores supporter contributions to campaigns.
- `payments` stores credit purchase transactions.
- `withdrawals` stores creator payout requests.
- `notifications` stores user messages about status changes.
- `reports` stores reported campaign issues.

---

## Entity relationships

```text
users
  ├─ creatorId ──> campaigns
  ├─ supporterId ─> contributions
  ├─ userId ──> payments
  ├─ creatorId ─> withdrawals
  ├─ userId ──> notifications
  └─ reportedBy ──> reports

campaigns
  └─ campaignId ──> contributions
  └─ campaignId ──> reports
```

---

## Data flow

1. User registration / login
   - `users` creates or verifies an account
   - auth token/session is used for protected routes

2. Creator adds a campaign
   - `POST /api/campaigns`
   - saves campaign in `campaigns`
   - status begins as `pending`

3. Admin approves campaign
   - updates `campaigns.status` to `approved`
   - optional notification entry in `notifications`

4. Supporter contributes to campaign
   - `POST /api/contributions`
   - new `contributions` document created with `pending`
   - if using credits, deduct from `users.credits`

5. Contribution approval
   - `PATCH /api/contributions/:id`
   - update contribution status
   - if approved, update `campaigns.raisedAmount`
   - optional notification to supporter and creator

6. Buying credits
   - `POST /api/payments/checkout`
   - external Stripe flow returns webhook event
   - `payments` record created
   - on success, increment `users.credits`

7. Creator withdrawal request
   - `POST /api/withdrawals`
   - request saved in `withdrawals`
   - admin approves / rejects with status update

8. Notifications and reports
   - `notifications` records status changes and actions
   - `reports` records issues submitted against campaigns
```

---

## Collection details

### `users`
Fields:
- `_id`
- `name`
- `email`
- `role`
- `credits`
- `profilePic`
- `createdAt`
- `updatedAt`

### `campaigns`
Fields:
- `_id`
- `creatorId`
- `title`
- `description`
- `goal`
- `raisedAmount`
- `deadline`
- `category`
- `imageUrl`
- `status`
- `createdAt`
- `updatedAt`

### `contributions`
Fields:
- `_id`
- `supporterId`
- `campaignId`
- `amount`
- `status`
- `createdAt`
- `updatedAt`

### `payments`
Fields:
- `_id`
- `userId`
- `type`
- `amount`
- `credits`
- `status`
- `stripeSessionId`
- `createdAt`

### `withdrawals`
Fields:
- `_id`
- `creatorId`
- `creditsRequested`
- `amountPaid`
- `status`
- `requestedAt`
- `processedAt`

### `notifications`
Fields:
- `_id`
- `userId`
- `message`
- `route`
- `read`
- `createdAt`

### `reports`
Fields:
- `_id`
- `reportedBy`
- `campaignId`
- `reason`
- `status`
- `createdAt`

---

## How to use this diagram
- Use `users` as the central identity source.
- Use `campaigns` for all crowdfunding project data.
- Use `contributions` to track supporter payments and status.
- Use `payments` for credit purchases and transaction history.
- Use `withdrawals` for creator payout requests.
- Use `notifications` to display user messages.
- Use `reports` for moderation and campaign issues.

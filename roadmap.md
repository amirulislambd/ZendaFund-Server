# ZendaFund Backend Roadmap

## Goal
Build an Express + TypeScript + MongoDB backend for ZendaFund that supports:
- Role-based auth: supporter, creator, admin
- Campaign creation, approval, discovery, and management
- Contribution workflow and credit handling
- Payment top-up and withdrawal processing
- Notifications and admin moderation

---

## Folder Structure
This is the structure we should use for backend code organization:

- `index.ts`
- `src/`
  - `lib/`
    - `mongodb.ts` — MongoDB client helper and collection exports
    - `betterAuth.ts` — better-auth configuration and session helpers (if used)
  - `middleware/`
    - `auth.ts` — auth token/session verification and role guard middleware
    - `errorHandler.ts` — centralized error handling middleware
  - `types/`
    - `user.ts`
    - `campaign.ts`
    - `contribution.ts`
    - `payment.ts`
    - `withdrawal.ts`
    - `notification.ts`
    - `report.ts`
  - `routes/`
    - `auth.ts`
    - `campaigns.ts`
    - `contributions.ts`
    - `payments.ts`
    - `withdrawals.ts`
    - `notifications.ts`
    - `admin.ts`
  - `utils/`
    - `validation.ts`
    - `stripe.ts`
    - `images.ts`

---

## 1. Core Backend Setup

### What this does
This is the base setup for the entire server. It loads environment variables, configures middleware, mounts feature routes, and starts the HTTP server.

### Tasks
- `index.ts`
  - load `dotenv`
  - attach `cors()` and `express.json()`
  - mount each feature router under `/api`
  - add a health check route at `/`
  - use centralized error handler
- `src/lib/mongodb.ts`
  - create a singleton MongoDB client
  - export the connected database or commonly used collections
- `src/middleware/errorHandler.ts`
  - capture thrown errors and return consistent JSON responses

---

## 2. Database Collections

### Why this matters
This defines the shape of the data stored in MongoDB. Each collection is a separate feature area, and the fields tell frontend developers what data is available.

### `users`
- `name`
- `email`
- `passwordHash` (or token identity reference if using better-auth)
- `role` (`supporter | creator | admin`)
- `credits`
- `profilePic`
- `createdAt`
- `updatedAt`

### `campaigns`
- `creatorId`
- `title`
- `description`
- `goal`
- `raisedAmount`
- `deadline`
- `category`
- `imageUrl`
- `status` (`pending | approved | rejected`)
- `createdAt`
- `updatedAt`

### `contributions`
- `supporterId`
- `campaignId`
- `amount`
- `status` (`pending | approved | rejected`)
- `createdAt`
- `updatedAt`

### `payments`
- `userId`
- `type` (`credit_topup`)
- `amount`
- `credits`
- `status`
- `stripeSessionId`
- `createdAt`

### `withdrawals`
- `creatorId`
- `creditsRequested`
- `amountPaid`
- `status` (`pending | approved | rejected`)
- `requestedAt`
- `processedAt`

### `notifications`
- `userId`
- `message`
- `route`
- `read`
- `createdAt`

### `reports`
- `reportedBy`
- `campaignId`
- `reason`
- `status`
- `createdAt`

---

## 3. Authentication & Authorization

### Important note
You already use `better-auth` for auth and token verification. That means we do not need to rebuild auth from scratch. The backend should read the verified user/session data from better-auth and use it for authorization.

### What we need in the roadmap
- Use `better-auth` session or token verification middleware in `src/middleware/auth.ts`
- Extract authenticated user identity from the verified session
- Attach `req.user` or similar to keep downstream routes simple
- Enforce role-based access in route handlers

### Routes
- `POST /api/auth/register` — if direct registration exists
- `POST /api/auth/login` — if login is handled by frontend / better-auth endpoint
- `GET /api/auth/me` — return user profile and role
- `POST /api/auth/logout` — clear session or token

### Behavior
- No full auth rebuild needed: use the existing token/session verification from better-auth
- The backend should trust the verified identity and only verify it again when necessary
- The backend handles access rules, not the auth provider

---

## 4. Campaign APIs

### What it does
Campaign APIs let users browse, create, update, and moderate campaigns.

### Routes
- `GET /api/campaigns`
- `GET /api/campaigns/:id`
- `POST /api/campaigns` (creator only)
- `PATCH /api/campaigns/:id`
- `DELETE /api/campaigns/:id` (admin only)

### Behavior
- public list returns only `approved` campaigns
- support search, category filter, sort, and pagination
- creators can submit new campaigns for review
- admins can approve or reject campaigns

---

## 5. Contribution Flow

### What it does
This covers supporter actions to contribute and creator/admin actions to approve or reject.

### Routes
- `GET /api/contributions`
- `POST /api/contributions`
- `PATCH /api/contributions/:id`

### Behavior
- create a new contribution record in `pending`
- require supporter role to contribute
- on approval, update campaign `raisedAmount`
- if using credits, deduct from supporter account
- allow status changes by creator/admin only

---

## 6. Payments / Credit Top-up

### What it does
Payment APIs support buying credits and storing payment history.

### Routes
- `POST /api/payments/checkout`
- `POST /api/payments/webhook`
- `GET /api/payments`

### Behavior
- create a Stripe checkout session for credit purchase
- on webhook success, credit the user account
- return payment history for dashboard display

---

## 7. Withdrawals

### What it does
Withdrawals let creators convert credits to payout requests.

### Routes
- `GET /api/withdrawals`
- `POST /api/withdrawals`
- `PATCH /api/withdrawals/:id`

### Behavior
- creator can request withdrawal once minimum credit rules are met
- admin reviews and approves/rejects
- store request status and timestamps

---

## 8. Notifications

### What it does
Notifications inform users about status changes and important updates.

### Routes
- `GET /api/notifications`
- `PATCH /api/notifications/:id`
- `POST /api/notifications` (internal use)

### Triggers
- campaign approved or rejected
- contribution approved or rejected
- withdrawal approved or rejected
- any administrative update needing user notice

---

## 9. Admin & Management

### What it does
Admin APIs are for platform moderation and user/campaign control.

### Routes
- `GET /api/users`
- `PATCH /api/users/:id`
- `DELETE /api/users/:id`
- `GET /api/reports`
- `PATCH /api/reports/:id`
- `DELETE /api/reports/:id`

### Behavior
- manage roles and remove problematic users
- delete or moderate campaigns
- review reports and apply actions

---

## 10. Security & Validation

### What it does
This protects the backend and keeps responses consistent.

### Tasks
- add request validation in `src/utils/validation.ts`
- require environment values:
  - `MONGODB_URI`
  - `JWT_SECRET`
  - `STRIPE_SECRET`
  - `IMGBB_KEY`
- add centralized error handler in `src/middleware/errorHandler.ts`
- use secure CORS settings
- require auth middleware for protected routes

---

## 11. Task Breakdown

This section splits work into clear, ordered pieces so you can follow it step by step.

### Phase 1: Setup and core services
- [ ] Create folder structure in `src/`
- [ ] Build `src/lib/mongodb.ts`
- [ ] Add `src/middleware/auth.ts` with better-auth token/session verification
- [ ] Add `src/middleware/errorHandler.ts`
- [ ] Add health-check route in `index.ts`

### Phase 2: Data models and types
- [ ] Create `src/types/user.ts`
- [ ] Create `src/types/campaign.ts`
- [ ] Create `src/types/contribution.ts`
- [ ] Create `src/types/payment.ts`
- [ ] Create `src/types/withdrawal.ts`
- [ ] Create `src/types/notification.ts`
- [ ] Create `src/types/report.ts`

### Phase 3: Auth and session helper
- [ ] Configure better-auth integration if needed in `src/lib/betterAuth.ts`
- [ ] Build `GET /api/auth/me`
- [ ] Build `POST /api/auth/logout`
- [ ] Ensure `req.user` works in protected routes

### Phase 4: Campaign API
- [ ] Build `GET /api/campaigns`
- [ ] Build `GET /api/campaigns/:id`
- [ ] Build `POST /api/campaigns`
- [ ] Build `PATCH /api/campaigns/:id`
- [ ] Build `DELETE /api/campaigns/:id`

### Phase 5: Contribution workflow
- [ ] Build `POST /api/contributions`
- [ ] Build `GET /api/contributions`
- [ ] Build `PATCH /api/contributions/:id`
- [ ] Add campaign amount update logic on approval

### Phase 6: Payments and credit top-up
- [ ] Build checkout endpoint
- [ ] Build webhook endpoint
- [ ] Build payment history endpoint

### Phase 7: Withdrawal requests
- [ ] Build `POST /api/withdrawals`
- [ ] Build admin approval `PATCH /api/withdrawals/:id`
- [ ] Build list endpoints

### Phase 8: Notifications
- [ ] Build notification read endpoint
- [ ] Build user notification list endpoint
- [ ] Add notification generation in key flows

### Phase 9: Admin management
- [ ] Build user list/update/delete
- [ ] Build report list/update/delete
- [ ] Add campaign moderation actions

---

## Notes for your work
- Do not change existing code now. This roadmap only defines structure and order.
- Keep your current logic intact and add new files under `src/`.
- Because auth already uses better-auth, rely on that verified session instead of rebuilding login logic.
- Use this roadmap exactly as a guide for the next backend tasks.

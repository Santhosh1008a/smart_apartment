# Smart Apartment Platform — Execution Tasks

## Phase 1 — Critical Fixes
- [x] 1.1 Add input validation (Joi schemas + validate middleware)
- [x] 1.2 Fix role registration (strip role from public register)
- [x] 1.3 Separate JWT access & refresh secrets
- [x] 1.4 Secure environment variables (.env + .gitignore)
- [x] 1.5 Multi-tenancy — complex-level data isolation middleware

## Phase 2 — Backend Hardening
- [x] 2.1 Fix transaction handling (dedicated DB client)
- [x] 2.2 Add rate limiting
- [x] 2.3 Restrict CORS
- [x] 2.4 Add Razorpay webhook handler

## Phase 3 — Frontend ↔ Backend Integration
- [x] 3.1 Complete authentication flow (refresh token, interceptor)
- [x] 3.2 Create API service files (visitors, payments, services, admin)
- [x] 3.3 Replace mock data in all frontend pages
- [x] 3.4 Add missing backend endpoints
- [x] 3.5 Integrate Razorpay SDK in frontend

## Phase 4 — Backend Structure Improvements
- [ ] 4.1 Refactor to controller → service → repository
- [ ] 4.2 Add pagination to all list APIs
- [ ] 4.3 Add audit logging system

## Phase 5 — Advanced Features
- [ ] 5.1 Real-time emergency alerts (WebSocket)
- [ ] 5.2 Notification system (email/SMS)
- [ ] 5.3 File upload support

## Phase 6 — Production Readiness
- [ ] 6.1 API documentation (Swagger)
- [ ] 6.2 Logging & monitoring (Sentry, pino)
- [ ] 6.3 CI/CD pipeline
- [ ] 6.4 Deployment strategy

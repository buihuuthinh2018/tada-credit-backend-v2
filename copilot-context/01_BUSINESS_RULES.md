# Business Rules

- USER is the base identity (no CUSTOMER role)
- Roles define capabilities (ADMIN, CTV, SUPPORT, MANAGER, USER)
- Workflow and document requirements are dynamically configured by Admin
- No business logic is hardcoded in enum except technical states
- Financial data must be append-only (ledger based)
- Admin actions must always be logged

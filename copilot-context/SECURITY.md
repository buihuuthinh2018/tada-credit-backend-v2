# Security Policy

This document outlines the security principles and mechanisms applied throughout the system.

---

## 1. Security Objectives

- Protect user data and financial assets
- Prevent unauthorized access
- Ensure data integrity
- Provide full auditability
- Minimize attack surface

---

## 2. Authentication

- JWT-based authentication
- Access token with short TTL
- Refresh token strategy (recommended)
- Tokens are validated on every request

---

## 3. Authorization (RBAC)

- Role-Based Access Control
- No hardcoded role checks
- Permissions control:
  - API access
  - Workflow transitions
  - Admin operations

Authorization is enforced at:
- Controller guards
- Service-level validation

---

## 4. Principle of Least Privilege

- Users only receive required permissions
- Admin permissions are granular
- Workflow transitions require explicit permission

---

## 5. Data Protection

### Passwords
- Stored as salted hashes (bcrypt)
- Never logged
- Never returned in API responses

### Sensitive Data
- Phone numbers and emails are unique
- Financial data is never exposed without authorization

---

## 6. Financial Security

- All balance changes are ledger-based
- Transactions are immutable
- Wallet balance is derived data
- All financial operations are wrapped in DB transactions

This prevents:
- Double spending
- Race conditions
- Balance inconsistencies

---

## 7. Withdrawal Security

- Withdrawal requests require manual admin approval
- Admin must upload proof of payment
- Withdrawal state changes are audited
- Paid withdrawals cannot be reverted

---

## 8. Document Security

- Uploaded documents are:
  - Access-controlled
  - Associated with specific contracts
- Document review actions are logged
- File URLs should be private or signed (recommended)

---

## 9. Audit Logging

- All sensitive operations are logged:
  - Authentication events
  - Permission changes
  - Workflow transitions
  - Financial operations
- Logs include:
  - Actor
  - Action
  - Target
  - Timestamp
  - Metadata

---

## 10. API Security

- Input validation using DTOs
- No trust in client-side data
- Rate limiting recommended
- Admin APIs separated by route prefix

---

## 11. Database Security

- Snake_case schema to avoid ambiguity
- No raw SQL for business logic
- Prisma handles query escaping
- Database credentials stored in environment variables

---

## 12. Operational Security

- Environment variables for secrets
- Separate environments:
  - Development
  - Staging
  - Production
- Access to production DB is restricted

---

## 13. Incident Response

- Audit logs used for investigation
- Financial inconsistencies are traceable via ledger
- Compromised accounts can be suspended

---

## 14. Security Philosophy

> “Never trust input. Always log intent. Money must leave a trail.”

Security is treated as a core feature, not an afterthought.

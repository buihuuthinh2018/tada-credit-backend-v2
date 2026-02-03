# Financial Service & Credit Management Platform

A scalable, configurable backend system for **financial services, credit workflows, referral commissions, and wallet management**, built for real-world production use.

This project is designed with **config-driven business logic**, **dynamic workflows**, and **enterprise-grade auditability**.

---

## 🎯 Project Goals

- Build a **flexible financial service platform** without hardcoded business rules
- Allow Admin to configure:
  - Services
  - Required documents
  - Approval workflows
  - Roles & permissions
  - Commission & referral rules
- Ensure **financial correctness** with immutable ledger and full audit logs
- Be scalable for future microservice extraction

---

## 🧱 Tech Stack

### Backend
- **NestJS**
- **Prisma ORM**
- **MySQL**
- **JWT Authentication**
- **REST API**

### Frontend (planned)
- NextJS (App Router)
- TypeScript
- Zustand
- React Query
- TailwindCSS
- shadcn/ui

---

## 🧠 Core Concepts

### 1. User System

- `User` is the **only identity entity**
- No separate CUSTOMER entity
- Users may have multiple roles
- Registration fields:
  - Email
  - Phone
  - Password
  - Fullname
  - Gender
  - Birth date
  - Referral code
- OTP verification is **admin configurable**
  - Disabled → user is `ACTIVE`
  - Enabled → user is `PENDING_VERIFY`

---

### 2. Role & Permission (RBAC)

- Role-Based Access Control
- Fully dynamic (no hardcoded roles)
- A user can have multiple roles
- Roles define permissions
- Permissions control:
  - API access
  - Admin actions
  - Workflow transitions

Example roles:
- ADMIN
- USER
- CTV (Collaborator)
- SUPPORT
- MANAGER

---

### 3. Referral & Commission System

- Each user has a unique referral code
- Users may register under a referral code
- Creates a referral relationship (ecosystem)
- When a referred user uses a service:
  - Referrer earns commission
  - If referrer has **CTV role**, use CTV commission rate
  - Otherwise use default USER rate
- Commission configuration is admin-managed
- Snapshot date is configurable

---

### 4. Service System

- Admin can create multiple financial services
- Each service:
  - Has its own workflow
  - Requires specific documents
  - Includes configurable question sets
- No service logic is hardcoded

---

### 5. Workflow Engine (Dynamic)

- Workflow is versioned
- Each workflow includes:
  - Multiple stages
  - Ordered execution
  - Configurable transitions
- Transitions may require permissions
- Admin can create new workflow versions
- Contract status is derived from workflow stage

All stage changes are logged.

---

### 6. Document Management System

- Document types are configurable by Admin
- Each document has validation rules (JSON-based):
  - Number of files
  - File types
  - Size limits
  - Expiration rules
- A service may require multiple document types
- A document type may require multiple uploaded files
- Documents must be reviewed manually:
  - PENDING
  - APPROVED
  - REJECTED

---

### 7. Contract Lifecycle

- User submits a contract to use a service
- Must:
  - Upload required documents
  - Answer configured questions
- Contract is created as a draft
- After submission:
  - Enters workflow
  - Moves through stages
- Stage transitions are permission-protected
- Full stage history is recorded

---

### 8. Wallet & Ledger System

- Each user has exactly one wallet
- Wallet balance is derived from transactions
- All transactions are immutable
- Ledger-based accounting
- Supported operations:
  - Credit (commission, earning)
  - Debit (withdrawal)

---

### 9. Withdrawal System

- Users can request withdrawals
- Supported methods:
  - Banking
  - Crypto
- Withdrawal requires admin manual approval
- Admin must upload payment proof
- Withdrawal lifecycle:
  - PENDING
  - APPROVED
  - PAID
  - REJECTED

---

### 10. Audit Logging

- All sensitive actions are logged:
  - Admin operations
  - Workflow transitions
  - Financial changes
- Each log records:
  - Who performed the action
  - What was affected
  - When it happened
  - Metadata for traceability

---

## 🗄 Database Design

- MySQL
- Snake_case naming
- Prisma schema is the **single source of truth**
- No enum is used for business workflows
- Enums are only used for:
  - Technical states
  - Status flags
  - Operation types

---

## 🏗 Backend Architecture

- Modular NestJS architecture
- Domain-driven structure
- Each domain contains:
  - Module
  - Controller
  - Service
  - Repository
- Shared modules:
  - Auth
  - RBAC
  - Workflow engine
  - Audit
  - Prisma

---

## 🔐 Security Principles

- JWT-based authentication
- Permission-based authorization
- No direct role checks in controllers
- All financial operations wrapped in DB transactions

---

## 🌱 Seed Data

Initial seed includes:
- System roles
- Base permissions
- Default workflow
- Sample document requirements
- Admin account

---

## 🚀 Future Roadmap

- Admin Workflow Builder UI
- Document Template Versioning
- Multi-level referral commission
- Microservice extraction
- Event-driven architecture

---

## 📌 Design Philosophy

> “Business logic must live in configuration, not code.”

This system is built to **survive changing business requirements without schema rewrites**.

---

## 🧑‍💻 Developer Notes

- Do not hardcode workflows or documents
- Always use Prisma transactions for financial logic
- Log everything that matters
- Treat balance as derived data, not source of truth

---

## 📄 License

Private / Internal Use

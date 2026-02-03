# System Architecture

This document describes the high-level architecture, design principles, and structural decisions of the Financial Service & Credit Management Platform.

---

## 1. Architectural Goals

- Config-driven business logic (no hardcoded workflows)
- High auditability and traceability
- Financial correctness and data integrity
- Clear domain separation
- Easy scalability and future microservice extraction

---

## 2. High-Level Architecture

Client (Admin / User / CTV)
        |
        v
REST API (NestJS)
        |
        v
Domain Services
        |
        v
Prisma ORM
        |
        v
MySQL Database

---

## 3. Backend Framework

- NestJS for modular architecture, DI, and separation of concerns
- Prisma ORM as database abstraction and schema source of truth

---

## 4. Modular Structure

Each domain follows:

/modules/<domain>
- module
- controller
- service
- dto
- repository

Core domains include Auth, User, RBAC, Service, Workflow, Contract, Document, Commission, Wallet, Withdrawal, Audit.

---

## 5. Domain-Driven Principles

- Controllers: request handling only
- Services: business logic
- Repositories: database access only

---

## 6. Workflow Engine

- Dynamic, versioned workflows
- Services bind to a workflow version
- Contract state derived from workflow stage
- Transitions require permission and are audited

---

## 7. Document System

- Configurable document requirements
- JSON-based validation rules
- Multi-file per document support
- Manual review with audit trail

---

## 8. Financial Architecture

- Ledger-based wallet system
- Immutable transactions
- Balance is derived, not stored
- DB transactions for all financial operations

---

## 9. Referral & Commission

- User-to-user referral graph
- Role-based commission rates
- Snapshot-based aggregation
- Admin configurable

---

## 10. Audit Logging

- Centralized audit log
- Tracks admin actions, workflow transitions, financial changes
- Required for compliance and traceability

---

## 11. Scalability

- Modular monolith
- Clear boundaries for future microservices
- Wallet, Workflow, Commission are extractable services

---

## 12. Design Philosophy

Schema and configuration drive behavior, not code.

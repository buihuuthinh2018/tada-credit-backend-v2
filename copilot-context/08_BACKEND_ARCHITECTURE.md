# Backend Architecture

- Modular NestJS architecture
- Each domain has:
  - module
  - controller
  - service
  - repository (Prisma)
- Shared modules for:
  - auth
  - rbac
  - audit
  - workflow engine

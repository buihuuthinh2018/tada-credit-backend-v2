# TADA Credit - Frontend Documentation

## 📖 Tổng Quan

Đây là bộ tài liệu đầy đủ cho việc xây dựng Frontend của hệ thống **TADA Credit** - một nền tảng quản lý tín dụng, giới thiệu khách hàng và ví điện tử.

### 🎯 Mục Đích

Tài liệu này cung cấp mọi thông tin cần thiết để xây dựng một ứng dụng **NextJS** hoàn chỉnh với:
- ✅ **NextJS 14+** (App Router)
- ✅ **TailwindCSS** - Styling
- ✅ **Shadcn/ui** - Component library
- ✅ **Zustand** - State management
- ✅ **React Query (TanStack Query)** - Server state & caching

---

## 📚 Cấu Trúc Tài Liệu

### 1. **Getting Started**
- [00-OVERVIEW.md](./00-OVERVIEW.md) - Tổng quan hệ thống
- [INDEX.md](./INDEX.md) - Danh mục đầy đủ tất cả docs

### 2. **API Reference**
- [02-API-ENDPOINTS.md](./02-API-ENDPOINTS.md) - Danh sách đầy đủ API endpoints
- [03-AUTHENTICATION.md](./03-AUTHENTICATION.md) - Xác thực & Authorization
- [05-TYPESCRIPT-TYPES.md](./05-TYPESCRIPT-TYPES.md) - Tất cả TypeScript interfaces/types

### 3. **Integration Guides**
- [30-REACT-QUERY-SETUP.md](./30-REACT-QUERY-SETUP.md) - React Query configuration & patterns
- [50-COMPONENT-STRUCTURE.md](./50-COMPONENT-STRUCTURE.md) - Component structure & Shadcn setup

### 4. **Module Documentation**
- [13-WALLET-MODULE.md](./13-WALLET-MODULE.md) - Wallet & Transactions
- [42-CONTRACT-APPLICATION-FLOW.md](./42-CONTRACT-APPLICATION-FLOW.md) - Contract application flow

---

## 🚀 Quick Start

### Backend API
- **Base URL**: `http://localhost:3000/api`
- **Swagger Docs**: `http://localhost:3000/api/docs`

### Frontend Setup
```bash
# Create NextJS project
npx create-next-app@latest tada-credit-frontend --typescript --tailwind --app

# Install dependencies
npm install @tanstack/react-query @tanstack/react-query-devtools
npm install zustand axios
npm install react-hook-form @hookform/resolvers zod
npm install sonner

# Setup Shadcn/ui
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card input form table dialog select badge toast
```

---

## 📋 Implementation Checklist

### Phase 1: Setup
- [ ] Create NextJS project
- [ ] Setup folder structure
- [ ] Install dependencies
- [ ] Copy TypeScript types

### Phase 2: Authentication
- [ ] Setup Axios client with interceptors
- [ ] Create Zustand auth store
- [ ] Implement Login/Register pages
- [ ] Create protected route wrapper

### Phase 3: Core Features
- [ ] Dashboard layout
- [ ] Wallet module
- [ ] Contract application
- [ ] Withdrawal module

### Phase 4: Admin Panel
- [ ] Admin layout
- [ ] User management
- [ ] Contract management
- [ ] Audit logs

---

## 🔗 Next Steps

1. ✅ Đọc [00-OVERVIEW.md](./00-OVERVIEW.md) để hiểu hệ thống
2. ✅ Đọc [02-API-ENDPOINTS.md](./02-API-ENDPOINTS.md) để xem tất cả API
3. ✅ Đọc [03-AUTHENTICATION.md](./03-AUTHENTICATION.md) để setup auth
4. ✅ Đọc [INDEX.md](./INDEX.md) để xem danh mục đầy đủ
5. ✅ Bắt đầu code! 🎉

# System Architecture Documentation

## High-Level Architecture

┌─────────────────────────────────────────────────────────────────┐ │ CLIENT LAYER │ │ │ │ ┌──────────────────────────────────────────────────────────┐ │ │ │ React Application (Vite) │ │ │ │ ├─ Pages (Schedule, Reports, Admin, Stats) │ │ │ │ ├─ Components (Grid, Modal, Sidebar) │ │ │ │ ├─ Hooks (useSchedule, useUsers, useAuth) │ │ │ │ ├─ State Management (Zustand) │ │ │ │ └─ Socket.io (Real-time updates) │ │ │ └──────────────────────────────────────────────────────────┘ │ └──────────────────┬──────────────────────────────────────────────┘ │ HTTP REST API │ Socket.io (WebSocket) │ ┌──────────────────▼──────────────────────────────────────────────┐ │ API GATEWAY / SERVER │ │ │ │ ┌──────────────────────────────────────────────────────────┐ │ │ │ Express.js Server (Node.js) │ │ │ │ ├─ Middleware │ │ │ │ │ ├─ Authentication (JWT) │ │ │ │ │ ├─ Authorization (Role-based) │ │ │ │ │ ├─ Error Handling │ │ │ │ │ └─ Logging (Morgan) │ │ │ │ ├─ Routes │ │ │ │ │ ├─ /api/v1/auth (login, register, me) │ │ │ │ │ ├─ /api/v1/allocations (CRUD + copy) │ │ │ │ │ ├─ /api/v1/absences (CRUD) │ │ │ │ │ ├─ /api/v1/weeks (CRUD + publish) │ │ │ │ │ ├─ /api/v1/reports (CRUD + approval) │ │ │ │ │ ├─ /api/v1/users (list, update) │ │ │ │ │ ├─ /api/v1/machines (CRUD) │ │ │ │ │ ├─ /api/v1/tasks (CRUD) │ │ │ │ │ ├─ /api/v1/customers (CRUD) │ │ │ │ │ └─ /api/v1/stats (analytics) │ │ │ │ └─ Socket.io │ │ │ │ ├─ allocation:created │ │ │ │ ├─ allocation:deleted │ │ │ │ └─ report:submitted │ │ │ └──────────────────────────────────────────────────────────┘ │ └──────────────────┬──────────────────────────────────────────────┘ │ Supabase Client │ ┌──────────────────▼──────────────────────────────────────────────┐ │ DATA ACCESS LAYER │ │ │ │ ┌──────────────────────────────────────────────────────────┐ │ │ │ Supabase Client (@supabase/supabase-js) │ │ │ │ ├─ .from('table').select() │ │ │ │ ├─ .insert() / .update() / .delete() │ │ │ │ ├─ Auth (JWT tokens) │ │ │ │ └─ Real-time subscriptions │ │ │ └──────────────────────────────────────────────────────────┘ │ └──────────────────┬──────────────────────────────────────────────┘ │ ┌──────────────────▼──────────────────────────────────────────────┐ │ DATABASE LAYER │ │ │ │ ┌──────────────────────────────────────────────────────────┐ │ │ │ Supabase PostgreSQL Database │ │ │ │ ├─ users (employee master) │ │ │ │ ├─ allocations (schedule assignments) │ │ │ │ ├─ absences (vacation/sick/etc) │ │ │ │ ├─ weeks (week scheduling periods) │ │ │ │ ├─ tasks (projects/jobs) │ │ │ │ ├─ machines (equipment inventory) │ │ │ │ ├─ machine_allocations (equipment schedule) │ │ │ │ ├─ time_reports (worker reporting) │ │ │ │ └─ customers (client companies) │ │ │ └──────────────────────────────────────────────────────────┘ │ └─────────────────────────────────────────────────────────────────┘

Copy
---

## Directory Structure

emmenegger-scheduler/ ├── docs/ │ ├── WHITEPAPER.md (This document) │ ├── ARCHITECTURE.md (System design) │ ├── DATABASE.md (Data model & tables) │ ├── MOSCOW.md (Requirements prioritization) │ ├── API.md (API endpoints) │ └── DEPLOYMENT.md (DevOps & deployment) │ ├── frontend/ │ ├── src/ │ │ ├── components/ │ │ │ ├── layout/ (AppShell, Header, Sidebar) │ │ │ ├── schedule/ (Grid, DragDrop, Weekly View) │ │ │ ├── admin/ (User CRUD, Settings) │ │ │ ├── worker/ (Time Reports, Personal View) │ │ │ ├── machines/ (Machine Grid, Allocation) │ │ │ └── shared/ (Button, Modal, Badge, Card) │ │ ├── contexts/ │ │ │ ├── authStore.ts (User auth state) │ │ │ ├── themeContext.ts (Dark/light mode) │ │ │ └── scheduleContext.ts (Schedule state) │ │ ├── hooks/ │ │ │ ├── useAuth.ts │ │ │ ├── useSchedule.ts │ │ │ ├── useUsers.ts │ │ │ └── useDragDrop.ts │ │ ├── pages/ (Route components) │ │ ├── styles/ (TailwindCSS, globals) │ │ ├── i18n/ (Translations: de, en, fr, pt) │ │ ├── utils/ (Helpers, formatters, date utils) │ │ ├── types/ (TypeScript interfaces) │ │ ├── App.tsx (Main router) │ │ └── main.tsx (Entry point) │ ├── vite.config.ts │ ├── tsconfig.json │ └── package.json │ ├── backend/ │ ├── src/ │ │ ├── api/ (Route handlers) │ │ │ ├── auth.routes.ts │ │ │ ├── users.routes.ts │ │ │ ├── allocations.routes.ts │ │ │ ├── absences.routes.ts │ │ │ ├── weeks.routes.ts │ │ │ ├── tasks.routes.ts │ │ │ ├── machines.routes.ts │ │ │ ├── reports.routes.ts │ │ │ ├── customers.routes.ts │ │ │ └── stats.routes.ts │ │ ├── middleware/ (Auth, validation, error handling) │ │ │ ├── auth.ts (JWT verification, role checking) │ │ │ ├── errorHandler.ts │ │ │ └── validation.ts │ │ ├── lib/ │ │ │ └── supabase.ts (Supabase client singleton) │ │ ├── types/ │ │ │ └── index.ts (Shared TypeScript types) │ │ └── server.ts (Express server & Socket.io) │ ├── tsconfig.json │ ├── package.json │ └── .env (Environment variables) │ └── shared/ ├── types/ (Shared TypeScript interfaces) └── constants/ (Roles, absence codes, i18n keys)

Copy
---

## Data Flow Examples

### **Allocation Creation Flow**

Frontend User drags task "A" onto employee "Marco" on Monday → allocationsRouter.post()

Backend Validation ✓ Check user has LOCAL_MANAGER/GLOBAL_MANAGER role ✓ Fetch week by weekId ✓ Calculate target date from KW + dayOfWeek ✓ Check for absence on that date ✓ Check for existing allocation (double-booking)

Database Write INSERT into allocations (user_id, task_id, week_id, day_of_week, time_slot, created_by_id)

Real-time Broadcast io.to(schedule:GARTEN_TIEFBAU:weekId) .emit('allocation:created', {allocation data})

Frontend Update Socket.io listener updates local state → Grid re-renders → Other managers see change in real-time

Copy
---

## Error Handling Strategy

**Error Codes:**

- `400` - Bad Request (validation error)
- `401` - Unauthorized (invalid token)
- `403` - Forbidden (insufficient role)
- `404` - Not Found (resource doesn't exist)
- `409` - Conflict (absence/double-booking)
- `500` - Server Error (unexpected)

**Error Response Format:**

```json
{
  "error": "Conflict",
  "message": "Employee has an absence on this day",
  "conflict": {
    "type": "ABSENCE_OVERLAP",
    "absenceCode": 1
  }
}
Performance Optimizations
Database Indexes on week_id, user_id, date, schedule_type
Query Optimization - Select only needed columns
Caching - React Query with 30s staleTime
Pagination - For large lists (future)
Real-time Push - Socket.io instead of polling
Security Measures
JWT Authentication - 7-day token expiry
Role-Based Access Control - Checked on every route
Input Validation - Zod schemas
SQL Injection Prevention - Supabase parameterized queries
CORS - Restricted to frontend URL only
Helmet - Security headers
Password Hashing - bcryptjs 12 rounds
Audit Logging - All changes logged with user/timestamp
Copy
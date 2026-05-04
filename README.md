# Emmenegger Dispatching & Planning System

## Architecture

```
emmenegger-project/
├── shared/              # Shared types + constants (used by both frontend & backend)
│   ├── types/           # TypeScript interfaces for all entities
│   └── constants/       # Roles, absence codes, schedule types, i18n keys
├── backend/             # Node.js + Express + Prisma + PostgreSQL
│   ├── prisma/          # Database schema + migrations + seed
│   ├── src/
│   │   ├── api/         # Route handlers (REST endpoints)
│   │   ├── auth/        # JWT + role-based middleware
│   │   ├── db/          # Prisma client singleton
│   │   ├── services/    # Business logic layer
│   │   ├── middleware/   # Auth, validation, error handling
│   │   └── types/       # Backend-specific types
│   └── scripts/         # Data migration from Excel, seed scripts
├── frontend/            # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/  # UI components organized by domain
│   │   │   ├── layout/  # Shell, sidebar, header, nav
│   │   │   ├── schedule/ # Weekly grid, drag-drop, views
│   │   │   ├── admin/   # User mgmt, customer/task CRUD, settings
│   │   │   ├── worker/  # Arbeiter reporting, personal view
│   │   │   ├── machines/ # Machine schedule grid
│   │   │   └── shared/  # Buttons, modals, pills, cards
│   │   ├── contexts/    # Auth, Theme, Language, Schedule state
│   │   ├── hooks/       # useAuth, useSchedule, useDragDrop, etc.
│   │   ├── pages/       # Route-level page components
│   │   ├── styles/      # Theme tokens, global CSS
│   │   ├── types/       # Frontend-specific types
│   │   ├── utils/       # Date helpers, formatters, validators
│   │   └── i18n/        # DE, EN, FR, PT translation files
│   └── public/
└── docs/                # Architecture docs, API spec, data model
```

## Tech Stack

| Layer        | Technology                     | Rationale                                    |
|--------------|-------------------------------|----------------------------------------------|
| Frontend     | React 18 + TypeScript + Vite  | Fast DX, rich drag-drop ecosystem            |
| Styling      | Tailwind CSS + CSS variables  | Theme tokens for dark/light, utility-first   |
| Drag & Drop  | @dnd-kit/core + sortable      | Best React DnD library, accessible           |
| State        | Zustand + React Query         | Lightweight global state + server cache      |
| Backend      | Node.js + Express + TypeScript| REST API, WebSocket for live updates         |
| Database     | PostgreSQL + Prisma ORM       | Relational model fits grid data perfectly    |
| Auth         | JWT + bcrypt                  | Stateless auth, role-based access            |
| Real-time    | Socket.io                     | Live dashboard for office monitors           |
| Mobile       | React Native (Expo) or PWA    | Shared business logic with web frontend      |
| Hosting      | Swiss cloud (TBD)             | Data residency                               |

## Role-Based Access (3 Ranks)

| Role            | German          | View Scope      | Permissions                              |
|-----------------|-----------------|-----------------|------------------------------------------|
| Global Manager  | Geschäftsleiter | Whole company   | Full CRUD, admin panel, all departments  |
| Local Manager   | Teamleiter      | Team/department | Schedule editing, absences, team view    |
| Worker          | Arbeiter        | Personal only   | View own schedule, report time, log tasks|

## Data Model Summary

- **User**: id, name, email, role, department, abacusId, schedule_types[]
- **Schedule**: GARTEN_TIEFBAU | UNTERHALT (employees can be assigned to one or both)
- **Customer**: id, name, address, contact, notes, isRecurring
- **Task (Objekt)**: id, customerId, name, description, scheduleType, recurrence, weekPattern
- **Allocation**: userId + taskId + weekId + dayOfWeek + timeSlot
- **Absence**: userId + date + type (1-6) + source (manual | abacus_api)
- **Machine**: id, inventoryNr, name, type, tonnage, operator
- **MachineAllocation**: machineId + siteId + weekId + dayOfWeek
- **TimeReport**: userId + taskId + date + plannedHours + actualHours + status + notes

## Running Locally

```bash
# Backend
cd backend && npm install && npx prisma migrate dev && npm run dev

# Frontend
cd frontend && npm install && npm run dev
```

## API External Access

All REST endpoints are available at `/api/v1/*` with JWT bearer auth.
Future integrations: Abacus HR (OAuth2), Sorba Construction (TBD).
CSV import/export supported for all entity types.

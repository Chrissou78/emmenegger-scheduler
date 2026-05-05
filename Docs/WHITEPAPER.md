# Emmenegger Scheduler - Whitepaper

## Executive Summary

Emmenegger Scheduler is an enterprise-grade employee scheduling and dispatch management system designed for construction and landscaping companies. It enables real-time allocation of workers to projects, machine tracking, absence management, and comprehensive reporting capabilities.

**Version:** 1.0.0  
**Last Updated:** May 2026  
**Status:** Production Ready

---

## Problem Statement

Construction and landscaping companies face critical operational challenges:

- **Manual Scheduling:** Paper-based or spreadsheet workflows are error-prone and slow
- **Absence Conflicts:** Workers allocated despite vacation/sick leave causing project delays
- **Machine Utilization:** Difficulty tracking equipment allocation across multiple sites
- **Real-time Visibility:** Managers lack live visibility into workforce and machine deployment
- **Worker Accountability:** Limited time tracking and progress reporting from field workers
- **Data Silos:** No integration with existing HR systems (Abacus)

---

## Solution Overview

Emmenegger Scheduler provides:

### **Core Features**

1. **Weekly Scheduling Grid**
   - Drag-and-drop allocation of workers to tasks
   - Real-time conflict detection (absences, double-bookings)
   - Multi-week views with copy/paste functionality
   - Department-based filtering (Garden & Civil Engineering, Maintenance)

2. **Machine Tracking**
   - Machine inventory management by category and tonnage
   - Daily machine allocation to sites
   - Operator assignment tracking
   - Equipment utilization reports

3. **Absence Management**
   - 6 absence types: Vacation, School, Training (ÜK), Accident, Sick Leave, Part-time
   - Automatic conflict prevention during scheduling
   - Batch absence imports from Abacus HR API
   - Approval workflow for managers

4. **Worker Reporting**
   - Daily time reports with hours and task descriptions
   - Photo uploads for progress tracking
   - Manager approval workflow
   - Historical reporting and analytics

5. **Role-Based Access Control**
   - **Arbeiter (Workers):** View own schedule, submit time reports
   - **Local Manager:** Manage team schedules and approvals
   - **Global Manager:** Full system administration

6. **Multi-language Support**
   - German (Deutsch)
   - English
   - French (Français)
   - Portuguese (Português)

---

## Technical Architecture

### **Technology Stack**

**Frontend:**
- React 18 with TypeScript
- Vite for fast development
- TailwindCSS for styling
- Zustand for state management
- React Query for server state
- Drag-and-drop with dnd-kit
- Socket.io for real-time updates

**Backend:**
- Node.js + Express
- Supabase PostgreSQL
- Socket.io for live dashboard
- JWT authentication
- bcryptjs for password hashing

**Infrastructure:**
- Supabase (Database + Auth)
- Vercel (Frontend Deployment)
- Node.js Server (Backend)

---

## Data Model

### **Core Entities**

Copy
Users ├─ Allocations (many) ├─ Absences (many) ├─ Time Reports (many) └─ Weeks Created (many)

Tasks ├─ Allocations (many) ├─ Machine Allocations (many) └─ Time Reports (many)

Weeks ├─ Allocations (many) └─ Machine Allocations (many)

Machines └─ Machine Allocations (many)

Customers └─ Tasks (many)

Copy
---

## User Journeys

### **Manager Scheduling Workflow**

1. Create or open a week (KW number)
2. View all employees in department
3. Drag tasks from sidebar to employee cells
4. System checks for absences and conflicts
5. Changes broadcast live to other managers
6. Week can be published (locked against changes)

### **Worker Time Reporting**

1. View personal schedule
2. At end of day, submit time report
3. Attach photos/notes for transparency
4. Manager reviews and approves
5. Reports feed into monthly analytics

### **Absence Management**

1. Manager sets absence for employee
2. System blocks any allocations on that date
3. If absence already scheduled, user gets conflict warning
4. Absences can be synced from Abacus HR API

---

## Security & Compliance

- **Authentication:** JWT tokens with 7-day expiry
- **Authorization:** Role-based access control (RBAC)
- **Data Protection:** Encrypted at rest in Supabase
- **Audit Trail:** All changes logged with creator/timestamp
- **Password Policy:** bcryptjs with 12-round salt

---

## Future Roadmap

### **Phase 2 (Q3 2026)**
- Abacus HR API integration for automated absence sync
- SMS notifications for schedule changes
- Mobile app (React Native)

### **Phase 3 (Q4 2026)**
- AI-powered scheduling suggestions
- Predictive analytics for resource planning
- Advanced reporting dashboards

### **Phase 4 (2027)**
- Geolocation tracking for field workers
- GPS-based time clock in/out
- Client portal for project updates
- Logistic management for machines (via QR Code scanning : stock location, machines...)

---

## Success Metrics

- **Scheduling Efficiency:** 80% reduction in manual scheduling time
- **Absence Prevention:** 99% conflict-free allocations
- **System Uptime:** 99.9% availability
- **User Adoption:** 95% of managers actively using system within 3 months
- **Mobile Accessibility:** 60% of reports submitted via mobile

---

## Support & Maintenance

- **Training:** 2 days of on-site training for all users
- **Support:** Email support during business hours, dedicated Slack channel
- **Updates:** Monthly security patches, quarterly feature releases
- **Backup:** Daily automated backups with 30-day retention
# MoSCoW Requirements Prioritization

**Project:** Emmenegger Scheduler  
**Version:** 1.0.0  
**Date:** May 2026

---

## **MUST HAVE** (MVP - Non-negotiable)

These features must be implemented for the system to deliver core value.

### 1.1 User Authentication & Authorization
- [x] Login with email/password
- [x] JWT token-based authentication
- [x] Role-based access control (Arbeiter, Local Manager, Global Manager)
- [x] Session management (7-day token expiry)
- [x] Password hashing (bcryptjs)

### 1.2 Weekly Scheduling Grid
- [x] Display 6-day week (Mon-Sat) grid
- [x] Employee list with roles and departments
- [x] Drag-and-drop task allocation
- [x] Conflict detection (absence + double-booking)
- [x] Real-time updates via Socket.io
- [x] View allocations by week/year/schedule type
- [x] Task codes (a-z) with color coding

### 1.3 Absence Management
- [x] Create/delete absences (6 types: vacation, school, training, accident, sick, part-time)
- [x] Prevent allocation when absence exists
- [x] Date-based filtering
- [x] Absence source tracking (manual vs API)

### 1.4 Week Management
- [x] Create weeks (year + KW + schedule type)
- [x] Publish/lock weeks (workflow)
- [x] Copy allocations between weeks
- [x] Week status tracking (DRAFT/PUBLISHED/LOCKED)

### 1.5 User Management (Admin)
- [x] List all employees
- [x] View/edit user details (name, role, departments)
- [x] Soft delete users
- [x] Filter by department

### 1.6 Data Persistence
- [x] PostgreSQL database (Supabase)
- [x] All CRUD operations
- [x] Relational integrity
- [x] Automatic timestamps (created_at, updated_at)

### 1.7 Error Handling & Validation
- [x] Input validation (email, required fields)
- [x] HTTP error codes (400, 401, 403, 404, 409, 500)
- [x] User-friendly error messages
- [x] Conflict messages with details

### 1.8 Internationalization (i18n)
- [x] German (Deutsch)
- [x] English
- [x] French (Français)
- [x] Portuguese (Português)

---

## **SHOULD HAVE** (High Priority - Phase 1)

Important features that significantly enhance user experience but aren't essential for MVP.

### 2.1 Time Reporting
- [ ] Workers submit daily time reports
- [ ] Actual hours vs planned hours
- [ ] Work description field
- [ ] Photo uploads (progress tracking)
- [ ] Manager approval workflow
- [ ] Report status tracking

### 2.2 Machine Management
- [ ] Machine inventory CRUD
- [ ] Category-based filtering (Raupen Bagger, Radlader, etc.)
- [ ] Tonnage tracking
- [ ] Daily machine allocation
- [ ] Equipment utilization reports

### 2.3 Dashboard & Analytics
- [ ] Weekly utilization stats
- [ ] Employee allocation counts
- [ ] Task assignment distribution
- [ ] Absence trends
- [ ] Machine usage reports

### 2.4 Customers/Projects
- [ ] Customer master data
- [ ] Link tasks to customers
- [ ] Customer contact tracking
- [ ] Project notes field

### 2.5 Notifications
- [ ] In-app notifications for conflicts
- [ ] Toast messages for actions (create, delete)
- [ ] Email notifications for approvals (future)

### 2.6 Search & Filtering
- [ ] Search employees by name
- [ ] Filter tasks by schedule type
- [ ] Filter machines by category
- [ ] Date range filtering for reports

### 2.7 Theme Support
- [ ] Dark mode / Light mode toggle
- [ ] Theme persistence in localStorage
- [ ] Consistent styling (TailwindCSS)

---

## **COULD HAVE** (Nice to Have - Phase 2)

Enhancements that improve the system but aren't critical for launch.

### 3.1 Abacus HR Integration
- [ ] OAuth2 connection to Abacus
- [ ] Automated absence sync
- [ ] Employee master data import
- [ ] Salary/contract data integration

### 3.2 Advanced Scheduling
- [ ] AI-powered scheduling suggestions
- [ ] Bulk allocation tools
- [ ] Recurring task patterns
- [ ] Multi-week scheduling view

### 3.3 Reporting & Export
- [ ] PDF reports generation
- [ ] CSV export (allocations, reports)
- [ ] Excel integration
- [ ] Scheduled report emails

### 3.4 Mobile Support
- [ ] Responsive mobile design
- [ ] Time report submission via mobile
- [ ] Mobile notifications
- [ ] Native iOS/Android app (Phase 3)

### 3.5 Geolocation & Tracking
- [ ] GPS check-in/check-out
- [ ] Real-time worker location (heat map)
- [ ] Travel time optimization
- [ ] Geofence notifications

### 3.6 Advanced Analytics
- [ ] Predictive resource planning
- [ ] Utilization forecasting
- [ ] Cost analysis per project
- [ ] Performance KPI dashboards

### 3.7 Audit & Compliance
- [ ] Detailed change logs
- [ ] User action history
- [ ] Compliance reports
- [ ] Data retention policies

---

## **WON'T HAVE** (Out of Scope - Future Consideration)

Features explicitly excluded from current roadmap but may be revisited.

### 4.1 Out of Scope (v1.0)
- Payroll integration
- Invoice generation
- Budget tracking/billing
- Supply chain management
- Customer self-service portal
- Real-time GPS tracking
- Video conferencing
- Third-party integrations (Slack, Teams)
- Multi-company support
- Advanced ML scheduling

---

## Effort & Timeline Estimates

| Category | Status | Effort | Timeline |
|----------|--------|--------|----------|
| **MUST HAVE** | ✅ Complete | 120 hrs | Week 1-3 (MVP) |
| **SHOULD HAVE** | 🔄 In Progress | 80 hrs | Week 4-6 (Phase 1) |
| **COULD HAVE** | 📋 Planned | 120 hrs | Q3-Q4 2026 (Phase 2-3) |
| **WON'T HAVE** | ❌ Deferred | - | 2027+ |

---

## Priority Justification

### Why MUST HAVE items are critical:
1. **Authentication** - Security foundation for multi-user system
2. **Scheduling Grid** - Core business value (solves main problem)
3. **Conflict Detection** - Prevents operational errors
4. **Data Persistence** - Nothing works without database
5. **i18n** - Required for multinational workforce

### Why SHOULD HAVE items are important:
1. **Time Reporting** - Captures actual work (accountability)
2. **Machine Tracking** - Second critical resource
3. **Analytics** - Enables data-driven decisions
4. **Mobile** - Field workers need mobile access

### Why COULD HAVE items are deferred:
1. **Abacus Integration** - Nice-to-have, not blocking
2. **AI Scheduling** - Complexity vs benefit tradeoff
3. **Geolocation** - Privacy/compliance considerations
4. **Advanced Reports** - Core reports work for MVP

---

## Release Phases

### **v1.0 MVP (May 2026) - MUST HAVE**
- Login, scheduling, absences, weeks
- Basic user management
- Email support only

### **v1.1 Phase 1 (June 2026) - SHOULD HAVE (Critical)**
- Time reporting + approval
- Machine management
- Analytics dashboard
- Email notifications

### **v1.2 Phase 2 (Q3 2026) - COULD HAVE (High Priority)**
- Abacus HR integration
- Mobile responsive design
- Advanced filtering/search
- PDF exports

### **v2.0 Phase 3 (Q4 2026) - COULD HAVE (Nice-to-Have)**
- Native mobile apps
- Geolocation tracking
- Predictive analytics
- Customer portal
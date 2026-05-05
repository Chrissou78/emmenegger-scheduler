# Database Schema Documentation

## Overview

PostgreSQL database hosted on Supabase. All tables use UUID primary keys with automatic timestamps.

---

## Tables

### **users**

Employee master table. Stores user credentials and role information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Auto-generated UUID |
| email | VARCHAR(255) | UNIQUE, NOT NULL | Login email |
| password_hash | VARCHAR(255) | NOT NULL | bcryptjs hashed password |
| first_name | VARCHAR(100) | NOT NULL | Employee first name |
| last_name | VARCHAR(100) | NOT NULL | Employee last name |
| role | ENUM | CHECK (ARBEITER\|LOCAL_MANAGER\|GLOBAL_MANAGER) | User role |
| departments | TEXT[] | DEFAULT '{}' | ['GARTEN_TIEFBAU', 'UNTERHALT'] |
| abacus_id | VARCHAR(100) | UNIQUE | HR system integration ID |
| phone | VARCHAR(20) | | Contact number |
| avatar_url | VARCHAR(500) | | Profile photo URL |
| is_active | BOOLEAN | DEFAULT TRUE | Soft delete flag |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Indexes:**
- `idx_users_role` - for filtering by role
- `idx_users_abacus_id` - for HR integration

**Example:**
```sql
INSERT INTO users (email, password_hash, first_name, last_name, role, departments, is_active)
VALUES ('marco.cancela@emmenegger.ch', '$2a$12$...', 'Marco', 'Cancela', 'LOCAL_MANAGER', ARRAY['GARTEN_TIEFBAU'], TRUE);
weeks
Scheduling periods. Each week is unique per year/weekNumber/scheduleType combination.

Column	Type	Constraints	Description
id	UUID	PRIMARY KEY	
year	INTEGER	NOT NULL	Calendar year (e.g., 2026)
week_number	INTEGER	NOT NULL	KW number (1-53)
schedule_type	ENUM	CHECK (GARTEN_TIEFBAU|UNTERHALT)	Department schedule
status	ENUM	CHECK (DRAFT|PUBLISHED|LOCKED)	Draft/locked workflow
created_by_id	UUID	FK users.id	Who created the week
published_at	TIMESTAMP		When published
locked_at	TIMESTAMP		When locked
created_at	TIMESTAMP	DEFAULT NOW()	
updated_at	TIMESTAMP	DEFAULT NOW()	
Constraints:

UNIQUE (year, week_number, schedule_type) - One per schedule per week
Example:

CopyINSERT INTO weeks (year, week_number, schedule_type, status, created_by_id)
VALUES (2026, 18, 'GARTEN_TIEFBAU', 'DRAFT', 'uuid-of-manager');
allocations
Worker-to-task assignments. Daily time slot allocation.

Column	Type	Constraints	Description
id	UUID	PRIMARY KEY	
user_id	UUID	FK users.id, NOT NULL	Employee
task_id	UUID	FK tasks.id, NOT NULL	Task/project
week_id	UUID	FK weeks.id, NOT NULL	Week reference
day_of_week	INTEGER	CHECK (0-5), NOT NULL	0=Mon, 5=Sat
time_slot	INTEGER	CHECK (1-4), NOT NULL	1-4 shifts per day
created_by_id	UUID	FK users.id	Who created
created_at	TIMESTAMP	DEFAULT NOW()	
Constraints:

UNIQUE (user_id, week_id, day_of_week, time_slot) - No double-booking
Indexes:

idx_allocations_week_day - for weekly view
idx_allocations_user_week - for employee view
Example:

CopyINSERT INTO allocations (user_id, task_id, week_id, day_of_week, time_slot, created_by_id)
VALUES ('user-uuid', 'task-uuid', 'week-uuid', 0, 1, 'manager-uuid');
absences
Vacation, sick leave, training, etc. Blocks allocation on specific dates.

Column	Type	Constraints	Description
id	UUID	PRIMARY KEY	
user_id	UUID	FK users.id, NOT NULL	Employee
date	DATE	NOT NULL	Absence date
absence_code	INTEGER	CHECK (1-6)	1=Vacation, 2=School, 3=ÜK, 4=Accident, 5=Sick, 6=Part-time
source	ENUM	CHECK (MANUAL|ABACUS_API)	How it was created
notes	TEXT		Additional notes
approved_by_id	UUID	FK users.id	Approver
created_at	TIMESTAMP	DEFAULT NOW()	
Constraints:

UNIQUE (user_id, date) - One absence type per day
Example:

CopyINSERT INTO absences (user_id, date, absence_code, source, approved_by_id)
VALUES ('user-uuid', '2026-05-04', 1, 'MANUAL', 'manager-uuid');
tasks
Projects/jobs to allocate workers to.

Column	Type	Constraints	Description
id	UUID	PRIMARY KEY	
customer_id	UUID	FK customers.id	Client
code	VARCHAR(10)	NOT NULL	Display code (a-z)
name	VARCHAR(255)	NOT NULL	Task name
description	TEXT		Details
location	TEXT		Site address
schedule_type	ENUM	CHECK (GARTEN_TIEFBAU|UNTERHALT)	Which dept
status	ENUM	CHECK (ACTIVE|COMPLETED|PAUSED|CANCELLED)	Workflow status
is_recurring	BOOLEAN	DEFAULT FALSE	Repeats?
recurrence_type	ENUM	CHECK (NONE|WEEKLY|BIWEEKLY|MONTHLY|SEASONAL)	Pattern
recurrence_weeks	INTEGER[]		KW numbers for seasonal
seasonal_tasks	TEXT[]		Task abbreviations
estimated_hours	FLOAT		Budget hours
machines	TEXT[]		Machine IDs required
materials	TEXT		Material notes
color	VARCHAR(20)	DEFAULT '#8B7355'	Grid display color
sort_order	INTEGER	DEFAULT 0	Display order
created_at	TIMESTAMP	DEFAULT NOW()	
updated_at	TIMESTAMP	DEFAULT NOW()	
Indexes:

idx_tasks_schedule_type_status - for filtering
idx_tasks_customer_id - for customer tasks
machines
Equipment inventory.

Column	Type	Constraints	Description
id	UUID	PRIMARY KEY	
inventory_nr	VARCHAR(50)	UNIQUE, NOT NULL	Asset tag
name	VARCHAR(255)	NOT NULL	Description
category	ENUM	CHECK (RAUPEN_BAGGER|PNEU_BAGGER|...)	Equipment type
tonnage	FLOAT		Capacity
operator	ENUM	CHECK (EMMENEGGER|APPENZELLER)	Home company
is_active	BOOLEAN	DEFAULT TRUE	In service?
notes	TEXT		
created_at	TIMESTAMP	DEFAULT NOW()	
updated_at	TIMESTAMP	DEFAULT NOW()	
Indexes:

idx_machines_category - for filtering by type
machine_allocations
Daily machine assignments to sites.

Column	Type	Constraints	Description
id	UUID	PRIMARY KEY	
machine_id	UUID	FK machines.id	Equipment
site_id	UUID	FK tasks.id	Project location
week_id	UUID	FK weeks.id	Week
day_of_week	INTEGER	CHECK (0-5)	0=Mon, 5=Sat
created_by_id	UUID	FK users.id	Creator
created_at	TIMESTAMP	DEFAULT NOW()	
Constraints:

UNIQUE (machine_id, week_id, day_of_week) - One site per machine per day
time_reports
Worker daily time tracking.

Column	Type	Constraints	Description
id	UUID	PRIMARY KEY	
user_id	UUID	FK users.id	Worker
task_id	UUID	FK tasks.id	Project worked on
date	DATE		Work date
planned_hours	FLOAT		Scheduled hours
actual_hours	FLOAT		Hours worked
status	ENUM	CHECK (PLANNED|COMPLETED|PARTIAL|NOT_DONE|ADDED)	Report status
work_description	TEXT		What was done
notes	TEXT		Additional notes
photos	TEXT[]		Photo URLs
submitted_at	TIMESTAMP		When submitted
approved_by_id	UUID	FK users.id	Manager approver
approved_at	TIMESTAMP		When approved
created_at	TIMESTAMP	DEFAULT NOW()	
updated_at	TIMESTAMP	DEFAULT NOW()	
Constraints:

UNIQUE (user_id, task_id, date) - One report per worker per task per day
customers
Client companies.

Column	Type	Constraints	Description
id	UUID	PRIMARY KEY	
name	VARCHAR(255)	NOT NULL	Company name
address	TEXT		Street address
contact_name	VARCHAR(255)		Contact person
contact_phone	VARCHAR(20)		Phone number
contact_email	VARCHAR(255)		Email
notes	TEXT		Internal notes
is_active	BOOLEAN	DEFAULT TRUE	Active?
created_at	TIMESTAMP	DEFAULT NOW()	
updated_at	TIMESTAMP	DEFAULT NOW()	
Sample Queries
Get weekly allocations with employee and task details
CopySELECT 
  a.id,
  a.day_of_week,
  a.time_slot,
  u.first_name,
  u.last_name,
  t.code,
  t.name,
  t.color
FROM allocations a
JOIN users u ON a.user_id = u.id
JOIN tasks t ON a.task_id = t.id
WHERE a.week_id = $1
ORDER BY a.day_of_week, a.time_slot;
Check for conflicts before allocation
Copy-- Check absence
SELECT * FROM absences 
WHERE user_id = $1 AND date = $2;

-- Check double-booking
SELECT * FROM allocations 
WHERE user_id = $1 AND week_id = $2 AND day_of_week = $3 AND time_slot = $4;
Employee utilization report
CopySELECT 
  u.first_name,
  u.last_name,
  COUNT(a.id) as allocations,
  COUNT(DISTINCT a.task_id) as unique_tasks,
  COUNT(ab.id) as absence_days
FROM users u
LEFT JOIN allocations a ON u.id = a.user_id AND a.week_id = $1
LEFT JOIN absences ab ON u.id = ab.user_id AND EXTRACT(WEEK FROM ab.date) = $2
WHERE u.is_active = TRUE
GROUP BY u.id
ORDER BY u.first_name;
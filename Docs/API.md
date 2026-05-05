# API Documentation

## Base URL
https://api.emmenegger.local/api/v1

Copy
## Authentication
All protected routes require:
Authorization: Bearer {jwt_token}

Copy
## Endpoints Quick Reference

### Auth
- `POST /auth/login` - Login
- `POST /auth/register` - Register
- `GET /auth/me` - Current user

### Allocations
- `GET /allocations` - List
- `POST /allocations` - Create
- `DELETE /allocations/:id` - Delete
- `POST /allocations/copy-week` - Copy allocations

### Weeks
- `GET /weeks` - List
- `POST /weeks` - Create
- `PUT /weeks/:id` - Publish/lock

### Absences
- `GET /absences` - List
- `POST /absences` - Create
- `DELETE /absences/:id` - Delete

### Users
- `GET /users` - List
- `GET /users/:id` - Get one
- `PUT /users/:id` - Update
- `DELETE /users/:id` - Delete (soft)

### Reports
- `GET /reports` - List
- `POST /reports` - Create
- `PUT /reports/:id` - Update
- `DELETE /reports/:id` - Delete

### Machines
- `GET /machines` - List
- `POST /machines` - Create
- `GET /machines/allocations` - List allocations
- `POST /machines/allocations` - Create allocation
- `DELETE /machines/allocations/:id` - Delete allocation

### Tasks
- `GET /tasks` - List
- `POST /tasks` - Create
- `PUT /tasks/:id` - Update
- `DELETE /tasks/:id` - Delete

### Stats
- `GET /stats/week/:weekId` - Week stats
- `GET /stats/user/:userId` - User stats

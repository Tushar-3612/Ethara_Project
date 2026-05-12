# Team Task Manager (Production-Ready Full Stack)

Modern SaaS-style Team Task Manager with role-based workflows, static single-admin logic, project/task management, achievements, performance insights, and Railway-ready deployment setup.

## Tech Stack

- Backend: Node.js, Express.js, MongoDB, Mongoose, JWT, bcrypt, dotenv, cors
- Frontend: React (functional components), React Router DOM, Axios, Tailwind CSS, Vite

## Project Structure

```text
backend/
  models/
  routes/
  middleware/
  .env.example
  server.js
frontend/
  src/
    pages/
    components/
    services/
  .env.example
```

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and set values:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/team-task-manager
JWT_SECRET=replace_with_a_long_random_secret
CLIENT_ORIGIN=http://localhost:5173
```

Copy `frontend/.env.example` to `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

## Installation

### Backend

```bash
cd backend
npm install
npm start
```

Development mode:

```bash
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm start
```

Frontend runs on Vite default port (usually `http://localhost:5173`) and calls backend APIs at `http://localhost:5000/api`.

## API Endpoints

### Auth
- `POST /api/auth/signup`
- `POST /api/auth/login`

### Static Admin Login
- Only one admin is supported.
- Admin credentials are fixed:
  - Email: `admin@taskmanager.com`
  - Password: `1234`
- Signup does **not** allow role selection. Every new account is created as `member`.

### Projects
- `POST /api/projects` (admin only)
- `GET /api/projects`
- `PUT /api/projects/:id/members` (admin only) body: `{ add: [userId], remove: [userId] }`

### Tasks
- `POST /api/tasks` (admin only)
- `GET /api/tasks`
- `PUT /api/tasks/:id`

### Activities
- `GET /api/activities?limit=20`

### Users (admin helper)
- `GET /api/users` (admin only)
- `PUT /api/users/:id/rating` (admin only, 1-5)
- `GET /api/users/performance` (admin only)
- `GET /api/users/me/achievements` (auth user)

## Role Behavior

- Admin:
  - create projects
  - add/remove project members
  - assign tasks to members
  - view all users/tasks
  - rate members
  - view team performance and top performer
- Member:
  - view only assigned tasks
  - update own task status
  - view achievements and contribution history

## Frontend Features

- Modern SaaS layout: sidebar + top navbar + cards
- Functional global search in navbar (task title search)
- Task filtering by status/project/user
- Color-coded status + overdue highlighting
- Avatar dropdown (Profile, Logout)
- Dark mode toggle (`☀️`/`🌙`)
- Dashboard with stats, activity feed, and circular performer indicator

## Railway Deployment Notes

- Create **two** Railway services: `backend` and `frontend`.
- **Backend**: set `MONGO_URI`, `JWT_SECRET`, and `CLIENT_ORIGIN` (your deployed frontend URL). Expose `PORT` automatically (Railway injects it).
- **Frontend**: set `VITE_API_URL` to your deployed backend URL + `/api`.
- Verify `CLIENT_ORIGIN` exactly matches the deployed frontend domain.

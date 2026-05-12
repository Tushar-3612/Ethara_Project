# 🚀 Ethara – Enterprise Team Task & Attendance Management System

Ethara is a modern SaaS-style full-stack management platform built for teams, students, mentors, and organizations to manage projects, attendance, tasks, leaves, performance tracking, and collaboration in one centralized dashboard.

The platform includes role-based access control, attendance analytics, batch management, project tracking, leave management, guide monitoring, and cloud deployment using Railway & MongoDB Atlas.

---

# 🌐 Live Deployment

## Frontend
https://awake-magic-production-3f5a.up.railway.app

## Backend API
https://etharaproject-production-2f20.up.railway.app

---

# 📌 Core Features

## 🔐 Authentication & Authorization
- JWT-based secure authentication
- Login & Signup system
- Role-based access control
- Static Admin authentication
- Protected routes & middleware

### Roles
- Admin
- Guide / Mentor
- Member / Student

---

# 👨‍💼 Admin Features

The Admin dashboard provides complete management and monitoring capabilities.

### Admin can:
- Create & manage projects
- Assign project members
- Manage batches
- Assign Guides/Mentors
- Assign tasks to users
- Monitor attendance
- Approve/reject leave requests
- Track team performance
- View completed/pending projects
- Rate users with star ratings
- Monitor analytics & activity logs
- Categorize projects:
  - Basic
  - Moderate
  - Hard

---

# 👨‍🏫 Guide / Mentor Features

Guides can monitor students assigned to their batches.

### Guide can:
- View assigned batch students
- Monitor attendance
- Edit attendance records
- Track student progress
- Monitor task completion
- Review daily work submissions
- Access project activity logs

---

# 👨‍💻 Member / Student Features

Members can participate in projects and manage their daily workflow.

### Member can:
- View assigned projects
- Track task progress
- Mark attendance
- Apply for leave
- View achievements
- Track completed tasks/projects
- View attendance history
- View performance analytics

---

# 📅 Attendance Management System

The platform includes a complete attendance management workflow.

### Features:
- Daily attendance marking
- Batch-based attendance
- Guide/Admin attendance controls
- Attendance edit history
- Attendance analytics
- Attendance history logs
- Performance tracking using attendance

---

# 📂 Project & Task Management

Ethara provides advanced project collaboration features.

### Features:
- Create projects
- Assign multiple members
- Multi-select member management
- Assign Guides & Coordinators
- Task assignment system
- Task status tracking
- Progress monitoring
- Time-based project completion rules
- Difficulty categorization

### Task Status:
- Pending
- In Progress
- Completed
- Blocked

---

# 📊 Analytics & Performance Tracking

The system tracks productivity and project performance.

### Features:
- User performance cards
- Team analytics
- Project completion metrics
- Attendance analytics
- Average completion time
- Achievement tracking
- Star rating system
- Productivity monitoring

---

# 📝 Leave Management

### Members can:
- Submit leave applications

### Admin/Guides can:
- Approve leaves
- Reject leaves
- Monitor leave history

---

# 🎨 UI/UX Features

Ethara uses a modern SaaS dashboard design.

### UI Features:
- Fully responsive layout
- Sidebar navigation
- Modern dashboard cards
- Search & filters
- Profile dropdown
- Avatar-based UI
- Clean spacing & layouts
- Mobile-friendly responsive design

---

# 🛠 Tech Stack

## Frontend
- React.js
- React Router DOM
- Axios
- Tailwind CSS
- Vite

## Backend
- Node.js
- Express.js
- MongoDB Atlas
- Mongoose
- JWT Authentication
- bcrypt
- dotenv
- cors

## Deployment
- Railway
- MongoDB Atlas
- GitHub

---

# 📁 Project Structure

```text
backend/
  models/
  routes/
  middleware/
  controllers/
  server.js

frontend/
  src/
    components/
    pages/
    services/
    context/
````

---

# ⚙️ Environment Variables

## Backend `.env`

```env
PORT=5000
MONGO_URI=your_mongodb_atlas_url
JWT_SECRET=your_secret_key
CLIENT_ORIGIN=your_frontend_url
```

## Frontend `.env`

```env
VITE_API_URL=your_backend_url/api
```

---

# 🚀 Installation Guide

## Backend Setup

```bash
cd backend
npm install
npm run dev
```

---

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

---

# 🌍 Deployment

The application is fully deployed using:

* Railway (Frontend + Backend)
* MongoDB Atlas (Cloud Database)
* GitHub (Version Control)

---

# 🔑 Demo Login Credentials

## 👨‍💼 Admin

Email:

```text
admin@ethara.com
```

Password:

```text
admin123
```

---

## 👨‍🏫 Guide

Email:

```text
tusharnagare7875@gmail.com
```

Password:

```text
1234
```

---

# 👨‍💻 Demo Members

| Name         | Email                                           | Password |
| ------------ | ----------------------------------------------- | -------- |
| Rahul Sharma | [rahul@ethara.tech](mailto:rahul@ethara.tech)   | 1234     |
| Priya Verma  | [priya@ethara.tech](mailto:priya@ethara.tech)   | 1234     |
| Bharat Kolhe | [bharat@ethara.tech](mailto:bharat@ethara.tech) | 1234     |

---

# 📌 Demo Project

## Project Name

Smart Attendance & Task Automation System

## Difficulty

Hard

## Guide

Tushar Nagare

## Batch

Batch A

---

# 📌 Sample Requirements

### 1. Frontend Dashboard Development

Develop a responsive SaaS dashboard with analytics cards, attendance widgets, project tracking, and task overview sections.

### 2. Attendance Management API

Build backend APIs for attendance tracking, attendance history, and guide/admin controls.

### 3. Leave Management System

Create leave request workflows with approval/rejection functionality.

### 4. Project Analytics Module

Track completion rates, productivity, and attendance performance.

---

# 📌 Future Enhancements

* Real-time notifications
* WebSocket integration
* AI-based performance analytics
* Mobile application support
* Email notifications
* Daily productivity reports
* Real-time chat system

---

# 👨‍💻 Developer

Developed by Tushar Nagare 🚀

```
```

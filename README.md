# HAYRAT CENTER PLATFORM

A comprehensive student management system for Islamic educational centers, built with modern full-stack technologies.

[![Node.js](https://img.shields.io/badge/Node.js-v22-green)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.2-blue)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-12+-lightblue)](https://www.postgresql.org/)
[![Express.js](https://img.shields.io/badge/Express-5.2-yellow)](https://expressjs.com/)

## Overview

The HAYRAT CENTER PLATFORM is a complete solution for managing student interactions at Islamic educational centers in Kenya. It handles registration, accommodation, events, books/knowledge hub, payments, communications, and disciplinary records.

### Key Features

✅ **Student Management**
- Registration with admin approval workflow
- Multi-center support (Brothers & Sisters sections)
- Profile management and tracking

✅ **Book & Knowledge Hub**
- PDF upload with automatic page extraction
- Reading progress tracking
- Student notifications on new books
- Center-wise visibility control
- Download functionality

✅ **Accommodation Management**
- Building and room management
- Student assignments
- Occupancy tracking

✅ **Events & Attendance**
- Event scheduling
- Attendance marking
- Attendance analytics

✅ **Communications**
- SMS broadcasting (Africa's Talking)
- Email notifications (SMTP)
- In-app notifications
- Direct messaging

✅ **Financial Management**
- Fee plans and charges
- M-Pesa payment integration
- Payment tracking
- Receipt generation

✅ **Discipline & Progress**
- Disciplinary records
- Academic progress tracking
- Admin review system

## Technology Stack

### Backend
- **Node.js 22** - JavaScript runtime
- **Express.js 5.2** - Web framework
- **PostgreSQL 12+** - Relational database
- **JWT** - Authentication
- **multer** - File uploads
- **pdf-parse** - PDF processing
- **bcrypt** - Password hashing
- **Nodemailer** - Email service
- **Africa's Talking** - SMS service

### Frontend
- **Next.js 16** - React framework with SSR/SSG
- **React 19** - UI library
- **TypeScript 5** - Type safety
- **Tailwind CSS 4** - Styling

## Quick Start

### Prerequisites
- Node.js v18+ (tested on v22)
- PostgreSQL 12+
- npm v8+

### Installation

**1. Clone and setup database**
```bash
createdb hayrat_srms
createuser hayrat_user
psql -U hayrat_user -d hayrat_srms -f database/schema.sql
```

**2. Backend setup**
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your configuration
npm run dev
```

**3. Frontend setup**
```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:3000`

## Documentation

- **[ADMIN_GUIDE.md](./ADMIN_GUIDE.md)** - Admin user guide with screenshots
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Complete deployment and production guide
- **[PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md)** - Pre-deployment checklist
- **[COMPLETION_REPORT.md](./COMPLETION_REPORT.md)** - Project completion summary

## API Documentation

### Core Endpoints

**Authentication**
```
POST   /api/auth/register              - Register new student
POST   /api/auth/login                 - Login user
POST   /api/auth/verify-email          - Verify email
```

**Books (Students)**
```
GET    /api/student/books              - Get available books
POST   /api/student/books/:id/progress - Update reading progress
GET    /api/student/books/:id/download - Download book PDF
```

**Books (Admin)**
```
GET    /api/admin/books                - List all books
POST   /api/admin/books                - Upload book (with PDF file)
PATCH  /api/admin/books/:id            - Update book
DELETE /api/admin/books/:id            - Delete book
GET    /api/admin/books/:id/progress   - View student progress
```

**Notifications**
```
GET    /api/student/notifications      - Get notifications
PATCH  /api/student/notifications/:id/read - Mark as read
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete API documentation.

## Seeded Data

The system comes with real data:

### Books (4)
- **Letters** - 539 pages
- **The Rays** - 654 pages  
- **The Words** - 784 pages
- **Flashes from Risale-i Nur Collection** - 455 pages

### Users
- 13 approved students
- 2 super admins
- 2 section admins (brothers & sisters)

### Default Admin Account
```
Email:    superadmin@hayrat.com
Password: superadmin123
⚠️ Change immediately in production!
```

## Project Structure

```
HAYRAT-CENTER-PLATFORM/
├── backend/                          # Express API server
│   ├── src/
│   │   ├── controllers/             # Route handlers
│   │   ├── services/                # Business logic
│   │   ├── routes/                  # API endpoints
│   │   ├── middleware/              # Auth & validation
│   │   └── config/                  # Database config
│   ├── server.js
│   └── package.json
│
├── frontend/                         # Next.js application
│   ├── app/
│   │   ├── admin/                   # Admin pages
│   │   ├── student/                 # Student pages
│   │   └── [other pages]
│   ├── components/                  # React components
│   ├── lib/                         # Utilities
│   └── package.json
│
├── database/
│   └── schema.sql                   # PostgreSQL schema
│
├── Documentation/
│   ├── ADMIN_GUIDE.md              # Admin guide
│   ├── DEPLOYMENT.md               # Deployment guide
│   ├── PRODUCTION_CHECKLIST.md     # Pre-production checklist
│   └── COMPLETION_REPORT.md        # Completion summary
│
└── README.md
```

## Configuration

### Environment Variables

**Backend (.env)**
```
PORT=5000
DATABASE_URL=postgresql://user:pass@localhost:5432/hayrat_srms
JWT_SECRET=your-secret-key-min-32-chars
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

**Frontend (.env.local)**
```
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_APP_NAME=HAYRAT CENTER
```

## Features

### Book Upload System
- Upload PDF files (up to 50MB)
- Automatic page count extraction
- Base64 storage for reliability
- Student notifications on upload
- Download functionality
- Progress tracking

### Student Notifications
- In-app notification system
- Unread notification counter
- Notification history
- Mark as read functionality
- Actionable notification links

### Multi-Section Support
- Separate brothers and sisters centers
- Center-specific admin accounts
- Scoped visibility for books and resources
- Cross-center super admin view

### Security
- JWT authentication
- Role-based access control
- Input validation on all endpoints
- Password hashing with bcrypt
- File upload restrictions
- CORS configuration

## Deployment

For production deployment, see [DEPLOYMENT.md](./DEPLOYMENT.md) for:
- Step-by-step deployment instructions
- Nginx reverse proxy configuration
- PM2 process manager setup
- Docker containerization
- Database backup strategies
- Monitoring and maintenance

Quick deployment steps:
1. Follow [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md)
2. Set all environment variables
3. Run database migrations
4. Build frontend for production
5. Start backend server
6. Configure reverse proxy
7. Set up SSL certificates

## Testing

**Test Backend**
```bash
cd backend
npm start
# Health check at http://localhost:5000/api/health
```

**Test Frontend**
```bash
cd frontend
npm run dev
# Access at http://localhost:3000
```

**Test with Data**
```bash
cd backend
node test_db.js
```

## Security Considerations

⚠️ **Before Production:**
1. Generate new JWT secret (min 32 characters)
2. Change all default passwords
3. Update database credentials
4. Enable HTTPS/SSL
5. Configure firewall rules
6. Set up database backups
7. Enable security headers
8. Configure rate limiting

See [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) for complete security checklist.

## Support & Maintenance

### Common Issues

**Books don't appear for students**
- Check book is published
- Verify student is approved
- Confirm section scope
- Try browser refresh

**PDF upload fails**
- Ensure file is valid PDF (not encrypted)
- Check file size < 50MB
- Verify upload directory exists

**Database connection fails**
- Confirm PostgreSQL is running
- Verify credentials in .env
- Check database exists
- Verify user permissions

### Getting Help

1. Check documentation files
2. Review error logs
3. Consult [DEPLOYMENT.md](./DEPLOYMENT.md)
4. Contact system administrator

## Maintenance

### Regular Tasks
- **Daily**: Monitor error logs
- **Weekly**: Review security logs
- **Monthly**: Update dependencies, test backups
- **Quarterly**: Full security audit

### Backups
```bash
pg_dump hayrat_srms | gzip > backup_$(date +%Y%m%d).sql.gz
gunzip < backup_20260618.sql.gz | psql hayrat_srms
```

## License

Proprietary - HAYRAT CENTER

## Version

**v1.0.0** - Production Ready

---

**Last Updated**: June 18, 2026

For detailed information, see the documentation files in the project root.

### Quick Links
- 📚 [Admin Guide](./ADMIN_GUIDE.md)
- 🚀 [Deployment Guide](./DEPLOYMENT.md)
- ✅ [Production Checklist](./PRODUCTION_CHECKLIST.md)
- 📋 [Completion Report](./COMPLETION_REPORT.md)

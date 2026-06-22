# HAYRAT CENTER PLATFORM - PRODUCTION DEPLOYMENT GUIDE

## Overview
This is a complete student management system for the Islamic educational center. The system includes student registration, accommodation, events, library/books management, payments, and communication features.

## Prerequisites
- Node.js v18+ (v22 tested)
- PostgreSQL 12+
- npm v8+
- Git (for version control)

## Project Structure
```
├── backend/              # Express.js API server (Node.js)
├── frontend/             # Next.js React application
├── database/             # PostgreSQL schema
└── scripts/              # Utility scripts
```

## Installation & Setup

### 1. Database Setup
```bash
# Create database
createdb hayrat_srms

# Create database user
createuser -P hayrat_user  # Password: hayrat1234 (change in production!)

# Grant permissions
psql -U postgres -d hayrat_srms -c "GRANT ALL PRIVILEGES ON DATABASE hayrat_srms TO hayrat_user;"

# Load schema
psql -U hayrat_user -d hayrat_srms -f database/schema.sql
```

### 2. Backend Setup
```bash
cd backend

# Install dependencies
npm install

# Create .env file (use .env.example as template)
cp .env.example .env

# Edit .env with production values
nano .env

# Start development server
npm run dev

# Or start production server
npm start
```

### 3. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Create .env.local file
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_APP_NAME=HAYRAT CENTER
EOF

# Start development
npm run dev

# Build for production
npm run build
npm run start
```

## Environment Variables

### Backend (.env)
```
PORT=5000
DATABASE_URL=postgresql://hayrat_user:password@localhost:5432/hayrat_srms
JWT_SECRET=your-secret-key-min-32-chars
FRONTEND_URL=https://your-domain.com
NODE_ENV=production
CORS_ORIGIN=https://your-domain.com
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=https://api.your-domain.com
NEXT_PUBLIC_APP_NAME=HAYRAT CENTER SRMS
```

## Key Features

### 1. User Management
- Student registration with admin approval
- Role-based access (student, brothers_admin, sisters_admin, super_admin)
- Multi-section support (brothers/sisters centers)
- JWT authentication

### 2. Books & Knowledge Hub
- PDF book upload with automatic page counting
- Center-wise book visibility
- Student reading progress tracking
- Automatic student notifications on new books
- Download functionality

### 3. Accommodation
- Building and room management
- Student room assignments
- Occupancy tracking

### 4. Events & Attendance
- Event scheduling
- Attendance marking
- Attendance tracking and reporting

### 5. Communication
- SMS broadcasts (Africa's Talking integration)
- Email broadcasts (SMTP)
- Direct messaging
- In-app notifications

### 6. Payments
- M-Pesa integration
- Fee plans and charges
- Payment tracking
- Receipt generation

### 7. Disciplinary Management
- Incident recording
- Severity levels (minor, moderate, serious)
- Resolution tracking

### 8. Student Progress Tracking
- Academic progress updates
- Religious progress tracking
- Admin review system

## API Endpoints

### Authentication
```
POST   /api/auth/register       - Student registration
POST   /api/auth/login          - User login
POST   /api/auth/verify-email   - Email verification
```

### Admin Operations
```
GET    /api/admin/dashboard     - Admin dashboard stats
GET    /api/admin/books         - List all books
POST   /api/admin/books         - Upload new book (with file)
PATCH  /api/admin/books/:id     - Update book
DELETE /api/admin/books/:id     - Delete book
GET    /api/admin/students      - List all students
PATCH  /api/admin/approve/:id   - Approve student
```

### Student Operations
```
GET    /api/profile             - Get user profile
PUT    /api/profile             - Update profile
GET    /api/student/books       - List available books
POST   /api/student/books/:id/progress - Update reading progress
GET    /api/student/notifications - Get notifications
GET    /api/student/books/:id/download - Download book PDF
```

## Database Schema

### Core Tables
- `users` - User accounts with roles
- `profiles` - Student profile information
- `platform_books` - Book records
- `book_progress` - Student reading progress
- `notifications` - In-app notifications
- `accommodation_buildings/rooms` - Accommodation management
- `event_sessions/attendance` - Events & attendance
- `disciplinary_records` - Discipline tracking
- `fees/payments` - Payment tracking

### Settings Tables
- `app_settings` - Global app configuration
- `communication_settings` - Email/SMS provider setup

## Security Considerations

### Required for Production
1. **Strong JWT Secret**: Generate a random 32+ character string
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Database Security**:
   - Use strong passwords
   - Restrict DB access to localhost or VPN
   - Enable SSL connections

3. **CORS Configuration**: 
   - Only allow your frontend domain
   - Never use `origin: true` in production

4. **HTTPS**: 
   - Use SSL/TLS certificates
   - Redirect HTTP to HTTPS

5. **Environment Variables**:
   - Never commit .env files
   - Use environment-specific configuration
   - Rotate secrets regularly

6. **Rate Limiting**: 
   - Implement on login endpoint
   - Limit file uploads (default 50MB)

7. **Input Validation**:
   - All user inputs are validated
   - File type restrictions on PDFs

## Deployment

### Using Docker (Recommended)
```bash
# Create Dockerfile
docker build -t hayrat-backend .
docker run -p 5000:5000 --env-file .env hayrat-backend
```

### Using PM2 (Process Manager)
```bash
# Install PM2
npm install -g pm2

# Start backend
pm2 start backend/server.js --name "hayrat-api"

# Start frontend
pm2 start "npm run start" --name "hayrat-web" --cwd frontend/

# Save configuration
pm2 save

# Set to auto-restart on server reboot
pm2 startup
```

### Using Systemd
```bash
# Create service file
sudo nano /etc/systemd/system/hayrat-api.service

[Unit]
Description=HAYRAT API Service
After=network.target

[Service]
Type=simple
User=hayrat
WorkingDirectory=/home/hayrat/HAYRAT-CENTER-PLATFORM/backend
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
EnvironmentFile=/home/hayrat/HAYRAT-CENTER-PLATFORM/backend/.env

[Install]
WantedBy=multi-user.target

# Enable and start
sudo systemctl enable hayrat-api
sudo systemctl start hayrat-api
```

### Using Nginx Reverse Proxy
```nginx
upstream api {
  server localhost:5000;
}

upstream frontend {
  server localhost:3000;
}

server {
  listen 443 ssl http2;
  server_name api.your-domain.com;
  
  ssl_certificate /path/to/cert.pem;
  ssl_certificate_key /path/to/key.pem;
  
  location / {
    proxy_pass http://api;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }
}

server {
  listen 443 ssl http2;
  server_name your-domain.com;
  
  ssl_certificate /path/to/cert.pem;
  ssl_certificate_key /path/to/key.pem;
  
  location / {
    proxy_pass http://frontend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }
}
```

## Monitoring & Maintenance

### Logs
```bash
# Backend logs
tail -f logs/app.log

# Database logs
tail -f /var/log/postgresql/postgresql.log
```

### Backups
```bash
# Daily database backup
pg_dump hayrat_srms | gzip > backup_$(date +%Y%m%d).sql.gz

# Restore from backup
gunzip < backup_20260618.sql.gz | psql hayrat_srms
```

### Performance
- Monitor database query performance
- Implement caching for frequently accessed data
- Use indexes on commonly filtered columns
- Monitor file storage usage (PDFs)

## Default Admin Account

**Super Admin Login:**
- Email: `superadmin@hayrat.com`
- Password: `superadmin123`

⚠️ **CHANGE THIS IMMEDIATELY IN PRODUCTION**

## Troubleshooting

### Common Issues

1. **Database connection fails**
   ```bash
   # Check PostgreSQL is running
   sudo systemctl status postgresql
   
   # Verify credentials
   psql -U hayrat_user -d hayrat_srms
   ```

2. **CORS errors**
   - Verify `CORS_ORIGIN` matches frontend URL
   - Check `FRONTEND_URL` is correct

3. **File upload fails**
   - Ensure upload directory exists and is writable
   - Check file size doesn't exceed limit
   - Verify PDF is not corrupted

4. **JWT errors**
   - Generate new JWT secret
   - Clear browser localStorage
   - Ensure clocks are synchronized

## Support & Documentation

- API Documentation: See `/api/health` endpoint
- Database Schema: See `database/schema.sql`
- Frontend Components: See `frontend/components/`

## License
Proprietary - HAYRAT CENTER

## Version
v1.0.0

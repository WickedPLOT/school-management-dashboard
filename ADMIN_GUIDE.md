# HAYRAT CENTER PLATFORM - ADMIN QUICK START GUIDE

## Getting Started

### Login
1. Go to `/login`
2. Enter admin credentials provided
3. You'll see the admin dashboard

### First Time Setup (Super Admin Only)

#### 1. Create Section Admins
- Go to **Admin > Manage Admins**
- Click "Create New Admin"
- Enter email and password
- Select section (Brothers or Sisters)
- Click Create

#### 2. Configure System Settings
- Go to **Settings > General**
- Set center name
- Configure approval requirements
- Adjust attendance thresholds

## Managing Books

### Uploading Books

**Step 1: Prepare PDF**
- Ensure PDF file is less than 50MB
- PDF file name should be descriptive
- Keep PDF file with you

**Step 2: Upload**
- Go to **Library > Upload Book**
- Enter book title
- Select section scope (Brothers/Sisters/Both)
- Add optional description
- Upload PDF file
- Check "Publish immediately" if ready
- Click "Upload Book"

**Step 3: Automatic Actions**
- System automatically extracts page count
- Students in the section receive notification
- Book appears in their Knowledge Hub

### Managing Uploaded Books
- Go to **Library > Manage Books**
- View all uploaded books
- See student reading progress
- Publish/unpublish books
- Delete books (with confirmation)

### Viewing Student Progress
- Click on any book to see progress
- View which students have started reading
- See average reading progress
- View student notes

## Books Currently in the Hub

1. **Letters** (539 pages)
   - Collection from Risale-i Nur series
   - Available to all students

2. **The Rays** (654 pages)
   - Al-Shoo'aat by Said Nursi
   - Available to all students

3. **The Words** (784 pages)
   - Al-Kalimat by Said Nursi
   - Fundamental Islamic principles
   - Available to all students

4. **Flashes from Risale-i Nur Collection** (455 pages)
   - Selected insights and reflections
   - Available to all students

## Student Features

### Students Can:
- View available books in Knowledge Hub
- Download books to read offline
- Track reading progress
- Mark books as reading/completed
- Add personal notes
- See notifications about new books
- View reading statistics

### How Students See Books:
1. Login to student account
2. Go to **Knowledge Hub** or **Library**
3. See all available books
4. Click on book to start reading
5. Track progress as they read

## Managing Students

### Approving Students
- Go to **Registrations > Pending**
- Review student information
- Click Approve or Reject
- Approved students can now login

### Viewing Student Profiles
- Go to **Students > All Students**
- Click on student name
- View profile information
- See accommodation details
- Check reading progress

### Filtering Students
- By section (Brothers/Sisters)
- By status (Approved/Pending/Rejected)
- Search by name or email

## Notifications

### Automatic Notifications Sent:
- New book uploaded
- Student registered
- Payment received
- Event scheduled
- Issue reported

### Viewing Notifications:
- Students see notifications on login
- Bell icon shows unread count
- Click to read notifications
- Mark as read individually

## Troubleshooting

### Book Upload Fails
**Problem**: "PDF parsing failed"
- **Solution**: Ensure file is a valid, non-encrypted PDF
- Try re-exporting the PDF

**Problem**: "File too large"
- **Solution**: Maximum file size is 50MB
- Try compressing the PDF

### Students Don't See Books
- Check book is "Published"
- Check student is approved
- Check section scope matches
- Try refreshing browser

### Books Show 0 Pages
- System couldn't parse PDF
- This is normal for encrypted PDFs
- You can manually enter page count in manage view

## Common Tasks

### Daily Tasks
- Check pending student registrations
- Monitor new issue reports
- Review attendance for events

### Weekly Tasks
- Upload new study materials
- Review student reading progress
- Check message delivery status

### Monthly Tasks
- Generate attendance reports
- Review academic progress
- Archive completed events

## Important Contacts

**For Technical Support:**
- Contact: [Support Email]
- Hours: [Support Hours]

**For System Issues:**
- Emergency Contact: [Emergency Number]
- For database backups: [DBA Contact]

## Security Tips

⚠️ **Important:**
- Never share your login credentials
- Change password regularly
- Don't access from public WiFi for admin tasks
- Always logout when finished
- Report suspicious activity immediately

## Default Login Credentials

**Super Admin:**
```
Email:    superadmin@hayrat.com
Password: superadmin123
⚠️ CHANGE THIS IMMEDIATELY IN PRODUCTION
```

**Section Admins:**
- Email and password provided during setup
- One for Brothers section
- One for Sisters section

## Quick Reference

| Feature | Location | Role |
|---------|----------|------|
| Upload Book | Library > Upload Book | Admin |
| Manage Books | Library > Manage Books | Admin |
| View Students | Students > All Students | Admin |
| Approve Students | Registrations > Pending | Admin |
| Create Admin | Admin > Manage Admins | Super Admin |
| Settings | Settings > General | Super Admin |
| Dashboard | Dashboard | Admin |

## FAQ

**Q: Can I delete a book after students have started reading?**
A: Yes, but students will lose access. Consider unpublishing instead.

**Q: What happens when I upload a book?**
A: System extracts page count, saves file, and notifies eligible students.

**Q: Can students download books?**
A: Yes, they can download PDFs for offline reading.

**Q: How many books can I upload?**
A: Unlimited. System can handle hundreds of books.

**Q: Can I see which students haven't read a book?**
A: Yes, in the book progress view - filter for "not_started" status.

**Q: What if a PDF is corrupted?**
A: Upload will fail with error message. Check PDF and try again.

## Support

For issues, questions, or feature requests:
1. Check this guide first
2. Refer to DEPLOYMENT.md for technical details
3. Contact system administrator
4. Check system logs for errors

---

**Last Updated**: June 18, 2026
**Version**: 1.0.0

For full technical documentation, see DEPLOYMENT.md

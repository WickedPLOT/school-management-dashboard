# URGENT FIXES NEEDED - Priority List

## 🔴 CRITICAL - Books Not Displaying (JUST FIXED)
**Status**: ✅ FIXED
- Issue: apiFetch wasn't handling FormData properly
- Solution: Updated api.ts to skip Content-Type header for FormData
- Files updated: lib/api.ts, frontend/app/admin/books/upload/page.tsx

## 🔴 CRITICAL - Issue Pie Charts Not Showing
**Status**: ⚠️ TODO
**Files**: frontend/app/admin/issues/page.tsx, frontend/app/admin/progress/books/page.tsx

The issues pages are stubbed. Need to:
1. Implement `/frontend/app/admin/issues/page.tsx` with list of issues
2. Add pie chart for issue status distribution (pending, in_progress, resolved)
3. Query backend for issue statistics
4. Show filter by status

## 🔴 CRITICAL - Daily Activities Repeat Patterns
**Status**: ⚠️ TODO
**Files**: database/schema.sql, backend/src/controllers/residentLifeController.js

Current issues:
- Database only supports 'once' and 'daily' in repeat_mode enum
- Monday activity shows but Tuesday missing = repeat logic not working
- Need support for: specific days (Mon/Wed/Fri), weekdays only, one week only, full month

**Database changes needed:**
```sql
ALTER TABLE daily_schedules ADD COLUMN IF NOT EXISTS repeat_pattern VARCHAR(50);
-- Values: 'once', 'daily', 'weekdays', 'weekends', 'weekly_specific', 'week_only', 'month_only'

ALTER TABLE daily_schedules ADD COLUMN IF NOT EXISTS repeat_days VARCHAR(100);
-- JSON array of days: [1,3,5] for Mon/Wed/Fri

ALTER TABLE daily_schedules ADD COLUMN IF NOT EXISTS week_number INTEGER;
-- Which week in month (1-4)

ALTER TABLE daily_schedules ADD COLUMN IF NOT EXISTS end_date DATE;
-- For week_only and month_only types
```

## 🟠 HIGH - Calendar Feature Not Implemented
**Status**: ⚠️ TODO
**Files needed**:
- frontend/components/Calendar.tsx (NEW - reusable calendar component)
- frontend/app/admin/calendar/page.tsx (NEW - admin calendar view)
- frontend/app/student/calendar/page.tsx (NEW - student calendar view)

Requirements:
- Standalone calendar (not embedded)
- Color-coded daily activities (different color per activity type)
- Color-coded events (different color per event)
- Click to view day details
- Show both admin and student views
- Side panel with day details

## 🟠 HIGH - Routine Programs Not Clickable
**Status**: ⚠️ TODO  
**Files**: frontend/app/admin/routines/page.tsx, backend attendance endpoints

Current issue: Routines page shows list but can't click to take attendance.

Need to:
1. Add "Take Attendance" button for each routine
2. When clicked, open attendance modal
3. Allow marking students as present/absent/excused/late
4. Based on routine's repeat pattern, determine applicable dates
5. Post attendance data to backend

## 🟠 HIGH - Book List Issues
**Status**: ⚠️ PARTIALLY FIXED

### Issue A: Books uploaded but not showing in manage page
**Fixed**: apiFetch now handles FormData correctly

### Issue B: "Both centers" mixed in book list
**Current behavior**: Admin sees all books, not just their center's
**Fix needed**: bookController.js already filters by section (line 10-11)
Verify it's working - test with brothers vs sisters admin

### Issue C: Draft/Publish functionality
**Status**: ✅ WORKING (is_published field exists)
**UI issue**: Not clearly showing draft vs published

**Suggested UI changes**:
```tsx
- Add badge: "Draft" (grey) or "Published" (green)
- Add visual indicator in list
- Show only draft to admin, show published to students
```

## 🟠 HIGH - Book Detail Page Missing
**Status**: ⚠️ TODO
**Files needed**: frontend/app/admin/books/detail/page.tsx (NEW)

Current: No way to see student progress on each book

Solution:
1. Create /admin/books/[id]/page.tsx
2. Query GET /admin/books/:id/progress
3. Display:
   - Book cover/title
   - List of all students with their progress (pages, status, notes)
   - Sort by progress percentage
   - Filter by status (not_started, reading, completed)
   - Visual progress bars

## 🟠 HIGH - Book UI Improvements
**Status**: ⚠️ TODO
**File**: frontend/app/admin/books/manage/page.tsx

Needed changes:
1. Add "Upload Book" button at TOP of page
2. When clicked, show MODAL FORM (not navigate to new page)
3. Make book list BIGGER/wider on page
4. Show book preview/thumbnail if available
5. Sort options (alphabetical, date added, student progress)

## 🟡 MEDIUM - Section Filtering
**Status**: ⚠️ NEEDS VERIFICATION

All admin pages should filter data by their section (brothers/sisters):
- Books ✅ (already done)
- Issues ⚠️ (needs implementation)
- Daily schedules ⚠️ (needs verification)
- Routines ✅ (already done)
- Events ✅ (already done)

## 🟡 MEDIUM - Issue Management Pages
**Status**: ⚠️ TODO
**Files**: 
- frontend/app/admin/issues/page.tsx (main list with pie chart)
- frontend/app/admin/issues/pending/page.tsx
- frontend/app/admin/issues/inprogress/page.tsx
- frontend/app/admin/issues/resolved/page.tsx

## Testing Required
After fixes, test these scenarios:

1. **Book Upload**:
   - [ ] Admin A (brothers) uploads book
   - [ ] Book shows only to brothers students
   - [ ] Admin B (sisters) does NOT see it in manage
   - [ ] Admin B uploads book with "all" scope
   - [ ] Both see it in manage
   - [ ] Book appears in student Knowledge Hub immediately

2. **Daily Activities**:
   - [ ] Create activity for Monday only
   - [ ] Create activity for Mon/Wed/Fri
   - [ ] Create activity for weekdays only
   - [ ] Create activity for one week
   - [ ] Create activity for full month
   - [ ] Calendar shows all correctly

3. **Attendance**:
   - [ ] Click routine program
   - [ ] Modal opens with student list
   - [ ] Mark attendance
   - [ ] Data saves
   - [ ] Can see attendance history

---

## Recommended Fix Order
1. ✅ Books upload/manage (DONE - FormData fix)
2. 🔄 Verify book section filtering works
3. 📅 Implement calendar component  
4. 🔧 Fix daily activities repeat patterns
5. 📊 Implement issue charts
6. 📖 Create book detail page
7. 🎯 Make routines clickable for attendance
8. 💄 Improve UI (modal forms, better layout)

---

## Code References for Fixes

### Book Section Filtering (Already Working)
File: backend/src/controllers/bookController.js:1-6
```javascript
function adminSectionFilter(req, alias = 'pb') {
  if (req.user.role === 'super_admin') return { clause: '', params: [] };
  return { clause: ` AND ${alias}.section_scope IN ('all', $1)`, params: [req.user.section] };
}
```

### FormData Fix (DONE)
File: frontend/lib/api.ts - Now skips Content-Type for FormData

### Next Critical Fix
File: database/schema.sql - Add columns for advanced repeat patterns

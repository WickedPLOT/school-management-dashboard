# MySQL Conversion Progress

## Infrastructure (done)
- [x] `backend/package.json` — pg → mysql2
- [x] `backend/src/config/db.js` — Pool → mysql2/promise
- [x] `backend/src/config/bootstrap.js` — multi-statement exec
- [x] `database/schema.sql` — full MySQL rewrite

## Controllers (done)
- [x] `authController.js` — `$N` → `?`, `RETURNING` removed, `ON CONFLICT` → `ON DUPLICATE KEY`
- [x] `adminController.js` — same
- [x] `profileController.js` — same
- [x] `feeController.js` — same
- [x] `eventController.js` — same + `FILTER (WHERE)` → `SUM(CASE)`
- [x] `disciplinaryController.js` — same
- [x] `accommodationController.js` — same
- [x] `residentLifeController.js` — same (766 lines, largest)
- [x] `phaseTwoController.js` — same + `date_trunc` → `DATE_FORMAT`
- [x] `bookController.js` — same + `FILTER (WHERE)` → `SUM(CASE)`
- [x] `messageController.js` — same

## Services (done)
- [x] `communicationService.js` — same
- [x] `notificationService.js` — same + `RETURNING *` → `SELECT *`
- [x] `settingsService.js` — same

## Remaining
- [ ] Install mysql2 (`npm install`)
- [ ] Test locally
- [ ] Deploy and verify

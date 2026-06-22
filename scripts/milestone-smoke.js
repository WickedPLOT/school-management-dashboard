const BASE = 'http://127.0.0.1:5000/api';
const PUBLIC_FRONTEND = 'https://chemical-solved-sailing-automatic.trycloudflare.com';

const creds = {
  super: { email: 'super.admin@hayrat.com', password: 'admin123' },
  brothers: { email: 'brothers.admin@hayrat.com', password: 'admin123' },
  student: { email: 'student@hayrat.com', password: 'student123' },
};

const unique = `ms2.${Date.now()}@example.com`;

const state = {
  tokens: {},
  newUserId: null,
  newUserToken: null,
  inviteToken: null,
  buildingId: null,
  roomId: null,
  updateId: null,
  issueId: null,
  eventId: null,
  notificationId: null,
  resourceId: null,
};

async function api(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data };
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

async function login(label, email, password) {
  const result = await api('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  expect(result.status === 200, `${label} login failed: ${JSON.stringify(result.data)}`);
  state.tokens[label] = result.data.token;
  return result.data;
}

async function authed(path, token, options = {}) {
  return api(path, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
}

async function runStep(name, fn) {
  try {
    const detail = await fn();
    console.log(`PASS ${name}${detail ? ` :: ${detail}` : ''}`);
    return { name, status: 'PASS', detail };
  } catch (error) {
    console.log(`FAIL ${name} :: ${error.message}`);
    return { name, status: 'FAIL', detail: error.message };
  }
}

async function main() {
  const results = [];

  results.push(await runStep('Health check', async () => {
    const result = await api('/health');
    expect(result.status === 200 && result.data.ok === true, 'health endpoint did not return ok');
    return 'backend ok';
  }));

  results.push(await runStep('Role-based auth logins', async () => {
    await login('super', creds.super.email, creds.super.password);
    await login('brothers', creds.brothers.email, creds.brothers.password);
    await login('student', creds.student.email, creds.student.password);
    return 'super, brothers admin, and student logins verified';
  }));

  results.push(await runStep('Admin dashboard stats', async () => {
    const result = await authed('/admin/dashboard', state.tokens.brothers);
    expect(result.status === 200, `dashboard returned ${result.status}: ${JSON.stringify(result.data)}`);
    expect(typeof result.data.pending === 'number', 'dashboard stats payload malformed');
    return JSON.stringify(result.data);
  }));

  results.push(await runStep('Student profile read', async () => {
    const result = await authed('/profile', state.tokens.student);
    expect(result.status === 200, `profile returned ${result.status}`);
    expect(result.data.full_name, 'student profile missing full_name');
    return result.data.full_name;
  }));

  results.push(await runStep('Registration invite generation + validation', async () => {
    const invite = await authed('/admin/invite/single', state.tokens.brothers, { method: 'POST' });
    expect(invite.status === 200, `invite generation failed: ${JSON.stringify(invite.data)}`);
    const link = invite.data.link;
    const token = link.split('token=')[1];
    expect(token, 'invite token missing from generated link');
    state.inviteToken = token;

    const validation = await api(`/auth/validate-invite?token=${token}`);
    expect(validation.status === 200 && validation.data.valid === true, 'invite validation failed');
    return link;
  }));

  results.push(await runStep('Student registration with approval workflow', async () => {
    const register = await api('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invite_token: state.inviteToken,
        email: unique,
        password: 'student123',
        full_name: 'QA Test Student',
        phone: '0712345600',
        gender: 'male',
        institution: 'Test University',
        course: 'QA Review',
        year_of_study: 2,
        quran_level: 'Juz 5',
        home_county: 'Nairobi',
      }),
    });
    expect(register.status === 201, `registration failed: ${JSON.stringify(register.data)}`);
    expect(register.data.status === 'pending', 'registration did not enter pending state');

    const pendingLogin = await api('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: unique, password: 'student123' }),
    });
    expect(pendingLogin.status === 403, 'pending user login should be blocked');
    return unique;
  }));

  results.push(await runStep('Pending list + approval', async () => {
    const pending = await authed('/admin/pending-users', state.tokens.brothers);
    expect(pending.status === 200, `pending users failed: ${JSON.stringify(pending.data)}`);
    const entry = pending.data.find((item) => item.email === unique);
    expect(entry, 'newly registered student not found in pending list');
    state.newUserId = entry.id;

    const approve = await authed(`/admin/approve/${entry.id}`, state.tokens.brothers, { method: 'PATCH' });
    expect(approve.status === 200, `approval failed: ${JSON.stringify(approve.data)}`);

    const loginResult = await api('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: unique, password: 'student123' }),
    });
    expect(loginResult.status === 200, `approved user login failed: ${JSON.stringify(loginResult.data)}`);
    state.newUserToken = loginResult.data.token;
    return `approved user id ${entry.id}`;
  }));

  results.push(await runStep('Student profile update + admin profile search', async () => {
    const update = await authed('/profile', state.newUserToken, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'QA Test Student',
        phone: '0712345600',
        parent_name: 'Guardian Test',
        parent_phone: '0700000001',
        parent_email: 'guardian.test@example.com',
        gender: 'male',
        institution: 'Test University',
        course: 'QA Review',
        year_of_study: 3,
        quran_level: 'Juz 8',
        home_county: 'Mombasa',
      }),
    });
    expect(update.status === 200, `profile update failed: ${JSON.stringify(update.data)}`);

    const getProfile = await authed('/profile', state.newUserToken);
    expect(getProfile.status === 200 && getProfile.data.parent_name === 'Guardian Test', 'profile readback mismatch');

    const search = await authed(`/admin/profiles?q=${encodeURIComponent(unique)}`, state.tokens.brothers);
    expect(search.status === 200, `profile search failed: ${JSON.stringify(search.data)}`);
    const found = search.data.find((item) => item.email === unique);
    expect(found, 'approved user missing from profile search');

    const adminView = await authed(`/admin/profiles/${state.newUserId}`, state.tokens.brothers);
    expect(adminView.status === 200, `admin profile view failed: ${JSON.stringify(adminView.data)}`);
    return adminView.data.full_name;
  }));

  results.push(await runStep('Accommodation building + room + assignment', async () => {
    const building = await authed('/admin/accommodation/buildings', state.tokens.brothers, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `QA Dorm ${Date.now()}`, section_scope: 'brothers', manager_name: 'QA Manager' }),
    });
    expect(building.status === 201, `building create failed: ${JSON.stringify(building.data)}`);
    state.buildingId = building.data.id;

    const room = await authed('/admin/accommodation/rooms', state.tokens.brothers, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ building_id: state.buildingId, name: 'QA-1', capacity: 2 }),
    });
    expect(room.status === 201, `room create failed: ${JSON.stringify(room.data)}`);
    state.roomId = room.data.id;

    const assign = await authed('/admin/accommodation/assignments', state.tokens.brothers, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: state.newUserId, room_id: state.roomId }),
    });
    expect(assign.status === 200, `room assignment failed: ${JSON.stringify(assign.data)}`);

    const roomView = await authed(`/admin/accommodation/students/${state.newUserId}`, state.tokens.brothers);
    expect(roomView.status === 200 && roomView.data.room_id === state.roomId, 'admin room lookup mismatch');

    const myRoom = await authed('/profile/room', state.newUserToken);
    expect(myRoom.status === 200 && myRoom.data.room_id === state.roomId, 'student room lookup mismatch');
    return `${roomView.data.building_name} / ${roomView.data.room_name}`;
  }));

  results.push(await runStep('Student activity/progress update + admin review', async () => {
    const create = await authed('/profile/updates', state.newUserToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        track: 'academic',
        title: 'Semester performance update',
        summary: 'Completed coursework and maintained good attendance.',
        details: 'Assignments up to date and exam prep ongoing.',
        progress_score: 82,
      }),
    });
    expect(create.status === 201, `student update create failed: ${JSON.stringify(create.data)}`);
    state.updateId = create.data.id;

    const adminList = await authed('/admin/progress/updates', state.tokens.brothers);
    expect(adminList.status === 200, `admin updates list failed: ${JSON.stringify(adminList.data)}`);
    expect(adminList.data.find((item) => item.id === state.updateId), 'created update missing from admin list');

    const review = await authed(`/admin/progress/updates/${state.updateId}`, state.tokens.brothers, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_note: 'Reviewed and accepted.', progress_score: 88, review_status: 'reviewed' }),
    });
    expect(review.status === 200, `progress review failed: ${JSON.stringify(review.data)}`);
    return `update ${state.updateId} reviewed`;
  }));

  results.push(await runStep('Issue reporting + admin issue management', async () => {
    const create = await authed('/profile/issues', state.newUserToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Broken reading lamp',
        category: 'maintenance',
        location: 'QA-1',
        description: 'Lamp is flickering and then turns off.',
        attachment_name: 'evidence.txt',
        attachment_data: 'data:text/plain;base64,ZmFrZSBhdHRhY2htZW50',
      }),
    });
    expect(create.status === 201, `issue create failed: ${JSON.stringify(create.data)}`);
    state.issueId = create.data.id;

    const adminIssues = await authed('/admin/issues/reports', state.tokens.brothers);
    expect(adminIssues.status === 200, `admin issues list failed: ${JSON.stringify(adminIssues.data)}`);
    expect(adminIssues.data.find((item) => item.id === state.issueId), 'created issue missing from admin list');

    const update = await authed(`/admin/issues/reports/${state.issueId}`, state.tokens.brothers, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'resolved', admin_note: 'Lamp replaced.' }),
    });
    expect(update.status === 200, `issue update failed: ${JSON.stringify(update.data)}`);
    return `issue ${state.issueId} resolved`;
  }));

  results.push(await runStep('In-app notifications + read acknowledgement', async () => {
    const notifications = await authed('/profile/notifications', state.newUserToken);
    expect(notifications.status === 200, `notifications fetch failed: ${JSON.stringify(notifications.data)}`);
    expect(notifications.data.length >= 3, 'expected multiple notifications from issue/update workflow');
    state.notificationId = notifications.data[0].id;

    const read = await authed(`/profile/notifications/${state.notificationId}/read`, state.newUserToken, {
      method: 'PATCH',
    });
    expect(read.status === 200 && read.data.is_read === true, 'notification read mark failed');
    return `${notifications.data.length} notifications`;
  }));

  results.push(await runStep('Attendance event + roster + summary', async () => {
    const event = await authed('/admin/attendance/events', state.tokens.brothers, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'QA Halaqa',
        description: 'Attendance smoke test event',
        location: 'Main Hall',
        event_date: new Date(Date.now() + 3600_000).toISOString(),
        section_scope: 'brothers',
      }),
    });
    expect(event.status === 201, `event create failed: ${JSON.stringify(event.data)}`);
    state.eventId = event.data.id;

    const roster = await authed(`/admin/attendance/events/${state.eventId}`, state.tokens.brothers);
    expect(roster.status === 200, `event roster failed: ${JSON.stringify(roster.data)}`);
    expect(roster.data.roster.find((row) => row.id === state.newUserId), 'new user missing from event roster');

    const save = await authed(`/admin/attendance/events/${state.eventId}`, state.tokens.brothers, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        records: [
          { user_id: state.newUserId, status: 'present' },
          { user_id: 3, status: 'late' },
        ],
      }),
    });
    expect(save.status === 200, `attendance save failed: ${JSON.stringify(save.data)}`);

    const summary = await authed(`/admin/attendance/students/${state.newUserId}/summary`, state.tokens.brothers);
    expect(summary.status === 200 && Number(summary.data.present_count) >= 1, 'attendance summary missing present count');
    return `${summary.data.attendance_rate}% attendance`;
  }));

  results.push(await runStep('Knowledge hub admin upload + student access', async () => {
    const create = await authed('/admin/resources', state.tokens.brothers, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `QA Resource ${Date.now()}`,
        category: 'guides',
        description: 'Milestone smoke resource',
        resource_type: 'note',
        note_content: 'Remember to check in for weekly halaqa.',
        audience: 'students',
        section_scope: 'brothers',
        is_published: true,
      }),
    });
    expect(create.status === 201, `resource create failed: ${JSON.stringify(create.data)}`);
    state.resourceId = create.data.id;

    const studentResources = await authed('/profile/resources', state.newUserToken);
    expect(studentResources.status === 200, `student resources failed: ${JSON.stringify(studentResources.data)}`);
    expect(studentResources.data.find((item) => item.id === state.resourceId), 'created resource missing from student list');
    return `resource ${state.resourceId} visible to student`;
  }));

  results.push(await runStep('Email verification code send', async () => {
    const result = await api('/auth/email-code/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'roysamson494@gmail.com', purpose: 'milestone-check' }),
    });
    expect(result.status === 200, `email code request failed: ${JSON.stringify(result.data)}`);
    return 'verification email accepted by backend';
  }));

  results.push(await runStep('Bulk registration invite email send', async () => {
    const result = await authed('/admin/invite', state.tokens.super, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: PUBLIC_FRONTEND,
      },
      body: JSON.stringify({ emails: ['roysamson494@gmail.com'] }),
    });
    expect(result.status === 200, `bulk invite email failed: ${JSON.stringify(result.data)}`);
    expect(result.data.invites?.[0]?.emailed === true, 'bulk invite did not confirm emailed state');
    return result.data.invites[0].link;
  }));

  const passed = results.filter((item) => item.status === 'PASS').length;
  const failed = results.length - passed;
  console.log(`SUMMARY PASS=${passed} FAIL=${failed}`);
  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

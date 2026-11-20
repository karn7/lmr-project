import test from 'node:test';
import assert from 'node:assert/strict';
import { monthRange, calendarDays, bangkokToday, durationMinutes, isLateCheckIn, isEarlyCheckOut } from '../lib/attendance.mjs';

test('early checkout uses 19:00 on the work day and handles overnight checkout', () => {
  const record = { date: '2026-11-20', checkInAt: '2026-11-20T03:00:00Z' };
  assert.equal(isEarlyCheckOut({ ...record, checkOutAt: '2026-11-20T11:59:59Z' }), true);
  assert.equal(isEarlyCheckOut({ ...record, checkOutAt: '2026-11-20T12:00:00Z' }), false);
  assert.equal(isEarlyCheckOut({ ...record, checkOutAt: '2026-11-20T12:00:01Z' }), false);
  assert.equal(isEarlyCheckOut({ ...record, checkOutAt: '2026-11-20T18:00:00Z' }), false);
  assert.equal(isEarlyCheckOut(record), false);
  assert.equal(isEarlyCheckOut({ ...record, checkOutAt: 'invalid' }), false);
});

test('check-ins strictly after 10:00 Bangkok time are late', () => {
  assert.equal(isLateCheckIn('2026-11-20T09:59:59+07:00'), false);
  assert.equal(isLateCheckIn('2026-11-20T10:00:00+07:00'), false);
  assert.equal(isLateCheckIn('2026-11-20T10:00:01+07:00'), true);
  assert.equal(isLateCheckIn('2026-11-20T03:01:00Z'), true);
  assert.equal(isLateCheckIn('2026-11-19T17:30:00Z'), false);
  assert.equal(isLateCheckIn(null), false);
  assert.equal(isLateCheckIn('invalid'), false);
});

test('validates month and bounds December into the next year', () => {
  for (const value of [null, '', '2026-1', '2026-00', '2026-13', '2026-01-01', 'invalid']) assert.equal(monthRange(value), null);
  assert.deepEqual(monthRange('2026-12'), { start: '2026-12-01', end: '2027-01-01' });
});

test('calendar places days under Sunday-first weekdays and includes leap days', () => {
  for (const [month, count, offset] of [['2024-02', 29, 4], ['2026-02', 28, 0], ['2026-08', 31, 6]]) {
    const days = calendarDays(month);
    assert.equal(days.length % 7, 0);
    assert.equal(days.filter(Boolean).length, count);
    assert.equal(days[offset], `${month}-01`);
    assert.equal(days[offset + count - 1], `${month}-${count}`);
  }
});

test('Bangkok day boundary and overnight durations are independent of host timezone', () => {
  assert.equal(bangkokToday(new Date('2026-11-19T17:00:00Z')), '2026-11-20');
  assert.equal(durationMinutes({ checkInAt: '2026-11-19T16:00:00Z', checkOutAt: '2026-11-19T18:30:00Z' }), 150);
  assert.equal(durationMinutes({ checkInAt: '2026-11-19T16:00:00Z' }), null);
  assert.equal(durationMinutes({ checkInAt: '2026-11-19T18:00:00Z', checkOutAt: '2026-11-19T16:00:00Z' }), null);
});

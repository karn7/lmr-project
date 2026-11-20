export const ATTENDANCE_TIME_ZONE = 'Asia/Bangkok';

export function monthRange(month) {
  if (typeof month !== 'string' || !/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const [year, number] = month.split('-').map(Number);
  return {
    start: `${month}-01`,
    end: number === 12 ? `${year + 1}-01-01` : `${year}-${String(number + 1).padStart(2, '0')}-01`,
  };
}

export function calendarDays(month) {
  if (!monthRange(month)) return [];
  const [year, number] = month.split('-').map(Number);
  const offset = new Date(Date.UTC(year, number - 1, 1)).getUTCDay();
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const cells = Math.ceil((offset + count) / 7) * 7;
  return Array.from({ length: cells }, (_, index) => {
    const day = index - offset + 1;
    return day > 0 && day <= count ? `${month}-${String(day).padStart(2, '0')}` : null;
  });
}

export function bangkokToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ATTENDANCE_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

export function employeeLabel(record) {
  const name = record.fullnameTh || [record.firstnameTh, record.lastnameTh].filter(Boolean).join(' ') || record.employee;
  return record.employeeCode ? `${name} (${record.employeeCode})` : name;
}

export function isLateCheckIn(value) {
  if (!value) return false;
  const checkIn = new Date(value);
  if (!Number.isFinite(checkIn.getTime())) return false;
  const cutoff = new Date(`${bangkokToday(checkIn)}T10:00:00+07:00`);
  return checkIn.getTime() > cutoff.getTime();
}

export function durationMinutes(record) {
  if (!record.checkInAt || !record.checkOutAt) return null;
  const elapsed = new Date(record.checkOutAt).getTime() - new Date(record.checkInAt).getTime();
  return Number.isFinite(elapsed) && elapsed >= 0 ? Math.floor(elapsed / 60000) : null;
}

export function isEarlyCheckOut(record) {
  if (!record.checkOutAt || !record.checkInAt) return false;
  const checkIn = new Date(record.checkInAt);
  const checkOut = new Date(record.checkOutAt);
  if (!Number.isFinite(checkIn.getTime()) || !Number.isFinite(checkOut.getTime())) return false;
  const workDay = /^\d{4}-\d{2}-\d{2}$/.test(record.date || '') ? record.date : bangkokToday(checkIn);
  return checkOut.getTime() < new Date(`${workDay}T19:00:00+07:00`).getTime();
}

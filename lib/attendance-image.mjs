import { ATTENDANCE_TIME_ZONE, bangkokToday, calendarDays, durationMinutes, employeeLabel, isEarlyCheckOut, isLateCheckIn } from './attendance.mjs';

const weekdays = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const stamp = (value) => value ? new Date(value).toLocaleTimeString('th-TH', { timeZone: ATTENDANCE_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : 'ยังไม่ลงเวลาออก';

// Render the full month independently of viewport size and scroll position.
export async function attendanceImage({ month, monthTitle, employeeTitle, records }) {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('เบราว์เซอร์ไม่รองรับการสร้างรูปภาพ');
  const width = 1960, margin = 28, cellWidth = (width - margin * 2) / 7;
  const lineHeight = 26, font = '18px sans-serif';
  ctx.font = font;
  function wrap(text, maxWidth) {
    const lines = [];
    let line = '';
    const segments = typeof Intl.Segmenter === 'function'
      ? Array.from(new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(String(text)), (item) => item.segment)
      : Array.from(String(text));
    for (const segment of segments) {
      if (line && ctx.measureText(line + segment).width > maxWidth) { lines.push(line); line = ''; }
      line += segment;
    }
    lines.push(line);
    return lines;
  }
  const titleLines = wrap(`พนักงาน: ${employeeTitle}`, width - margin * 2);
  const grouped = new Map();
  for (const record of records) {
    if (!grouped.has(record.date)) grouped.set(record.date, []);
    const warning = isLateCheckIn(record.checkInAt) || isEarlyCheckOut(record);
    const texts = [employeeLabel(record)];
    if (record.branch) texts.push(`สาขา ${record.branch}`);
    texts.push(`เข้า ${stamp(record.checkInAt)}`, `ออก ${stamp(record.checkOutAt)}`);
    if (isLateCheckIn(record.checkInAt)) texts.push('มาสาย (หลัง 10:00 น.)');
    if (isEarlyCheckOut(record)) texts.push('ออกก่อนเวลา (ก่อน 19:00 น.)');
    if (record.checkOutAt && bangkokToday(new Date(record.checkOutAt)) !== record.date) {
      texts.push(`ออกวันที่ ${bangkokToday(new Date(record.checkOutAt))}`);
    }
    const minutes = durationMinutes(record);
    if (minutes !== null) texts.push(`ระยะเวลา ${Math.floor(minutes / 60)} ชม. ${minutes % 60} นาที`);
    else if (record.checkOutAt) texts.push('เวลาเข้า–ออกไม่ถูกต้อง');
    const lines = texts.flatMap((text) => wrap(text, cellWidth - 36));
    grouped.get(record.date).push({ lines, height: lines.length * lineHeight + 20, warning, closed: Boolean(record.checkOutAt) });
  }
  const days = calendarDays(month);
  const weeks = Array.from({ length: days.length / 7 }, (_, index) => days.slice(index * 7, index * 7 + 7));
  const heights = weeks.map((week) => Math.max(180, ...week.map((day) => 48 + (grouped.get(day) || []).reduce((sum, item) => sum + item.height + 10, 0))));
  const top = 100 + titleLines.length * lineHeight + 48;
  const height = top + heights.reduce((sum, value) => sum + value, 0) + 120;
  // Avoid silent browser canvas truncation on exceptionally large all-staff reports.
  if (height > 16000 || width * height > 30000000) throw new Error('ข้อมูลมากเกินไปสำหรับรูปเดียว กรุณาเลือกพนักงานรายคน');
  canvas.width = width; canvas.height = height;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#111827'; ctx.font = 'bold 30px sans-serif';
  ctx.fillText(`ปฏิทินลงเวลาพนักงาน — ${monthTitle}`, margin, 24);
  ctx.font = font;
  titleLines.forEach((line, index) => ctx.fillText(line, margin, 76 + index * lineHeight));
  ctx.fillStyle = '#6b7280'; ctx.fillText('เวลาไทย (Asia/Bangkok)', margin, 80 + titleLines.length * lineHeight);
  const headerY = top - 44;
  weekdays.forEach((day, index) => {
    ctx.fillStyle = '#f3f4f6'; ctx.fillRect(margin + index * cellWidth, headerY, cellWidth, 44);
    ctx.fillStyle = index === 0 || index === 6 ? '#dc2626' : '#374151';
    ctx.fillText(day, margin + index * cellWidth + 12, headerY + 10);
  });
  let y = top;
  weeks.forEach((week, weekIndex) => {
    week.forEach((day, index) => {
      const x = margin + index * cellWidth;
      ctx.fillStyle = day ? '#ffffff' : '#f9fafb'; ctx.fillRect(x, y, cellWidth, heights[weekIndex]);
      ctx.strokeStyle = '#d1d5db'; ctx.strokeRect(x, y, cellWidth, heights[weekIndex]);
      if (!day) return;
      ctx.fillStyle = '#111827'; ctx.font = 'bold 20px sans-serif'; ctx.fillText(String(Number(day.slice(-2))), x + 12, y + 10);
      ctx.font = font;
      const entries = grouped.get(day) || [];
      let entryY = y + 44;
      if (!entries.length) { ctx.fillStyle = '#9ca3af'; ctx.fillText('ไม่มีรายการ', x + 12, entryY); }
      for (const entry of entries) {
        ctx.fillStyle = entry.warning ? '#fef2f2' : entry.closed ? '#ecfdf5' : '#fffbeb';
        ctx.fillRect(x + 8, entryY, cellWidth - 16, entry.height);
        ctx.fillStyle = entry.warning ? '#b91c1c' : '#374151';
        entry.lines.forEach((line, lineIndex) => ctx.fillText(line, x + 18, entryY + 10 + lineIndex * lineHeight));
        entryY += entry.height + 10;
      }
    });
    y += heights[weekIndex];
  });
  ctx.fillStyle = '#6b7280'; ctx.font = font;
  ctx.fillText('สีแดง: มาสายหลัง 10:00 น. หรือออกก่อน 19:00 น. · สีเขียว: ลงเวลาออกแล้ว · สีเหลือง: ยังไม่ลงเวลาออก', margin, y + 22);
  ctx.fillText('ระยะเวลายังไม่หักเวลาพัก · ไม่มีรายการไม่ได้หมายถึงขาดงาน', margin, y + 54);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('สร้างรูปภาพไม่สำเร็จ กรุณาลองใหม่')), 'image/png'));
}

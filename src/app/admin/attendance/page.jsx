'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import AdminLayout from '../components/AdminLayout';
import { attendanceImage } from '../../../../lib/attendance-image.mjs';
import { ATTENDANCE_TIME_ZONE, bangkokToday, calendarDays, durationMinutes, employeeLabel, isLateCheckIn, isEarlyCheckOut, monthRange } from '../../../../lib/attendance.mjs';

const endpoint = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/admin/attendance`;
const weekdays = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const time = (value) => value ? new Date(value).toLocaleTimeString('th-TH', { timeZone: ATTENDANCE_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : '—';
const dateLabel = (date) => new Date(`${date}T00:00:00+07:00`).toLocaleDateString('th-TH', { timeZone: ATTENDANCE_TIME_ZONE, day: 'numeric', month: 'long', year: 'numeric' });
const hours = (minutes) => `${Math.floor(minutes / 60)} ชม. ${minutes % 60} นาที`;
async function readResponse(response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'ไม่สามารถโหลดข้อมูลได้');
  return data;
}

function AttendanceEntry({ record }) {
  const late = isLateCheckIn(record.checkInAt);
  const early = isEarlyCheckOut(record);
  const duration = durationMinutes(record);
  const checkoutDay = record.checkOutAt ? bangkokToday(new Date(record.checkOutAt)) : '';
  return <article className={`rounded-lg border p-2 text-xs ${late || early ? 'border-red-300 bg-red-50' : record.checkOutAt ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
    <p className="break-words font-semibold text-gray-900">{employeeLabel(record)}</p>
    {late && <p className="mt-1 font-semibold text-red-700">มาสาย (หลัง 10:00 น.)</p>}
    {early && <p className="mt-1 font-semibold text-red-700">ออกก่อนเวลา (ก่อน 19:00 น.)</p>}
    {record.branch && <p className="mt-1 break-words text-gray-500">สาขา {record.branch}</p>}
    <p className={`mt-2 ${late ? 'font-semibold text-red-700' : 'text-gray-700'}`}>เข้า <time dateTime={record.checkInAt}>{time(record.checkInAt)}</time></p>
    <p className={early ? 'font-semibold text-red-700' : 'text-gray-700'}>ออก {record.checkOutAt ? <time dateTime={record.checkOutAt}>{time(record.checkOutAt)}</time> : <span className="font-medium text-amber-800">ยังไม่ลงเวลาออก</span>}</p>
    {checkoutDay && checkoutDay !== record.date && <p className="mt-1 text-gray-600">ออกวันที่ {dateLabel(checkoutDay)}</p>}
    {duration !== null && <p className="mt-1 text-emerald-800">ระยะเวลา {hours(duration)}</p>}
    {record.checkOutAt && duration === null && <p className="mt-1 text-red-700">เวลาเข้า–ออกไม่ถูกต้อง</p>}
  </article>;
}

export default function AttendancePage() {
  const { data: session, status } = useSession();
  const [month, setMonth] = useState(() => bangkokToday().slice(0, 7));
  const [employee, setEmployee] = useState('');
  const [employees, setEmployees] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [optionsError, setOptionsError] = useState('');
  const [revision, setRevision] = useState(0);
  const [loadedSelection, setLoadedSelection] = useState('');
  const [savingImage, setSavingImage] = useState(false);
  const [imageError, setImageError] = useState('');
  const isAdmin = session?.user?.role === 'admin';

  useEffect(() => {
    if (!isAdmin) return;
    const controller = new AbortController();
    setOptionsError('');
    fetch(`${endpoint}?options=1`, { cache: 'no-store', signal: controller.signal }).then(readResponse)
      .then((data) => setEmployees(data.employees))
      .catch((err) => { if (err.name !== 'AbortError') setOptionsError(err.message); });
    return () => controller.abort();
  }, [isAdmin, revision]);

  useEffect(() => {
    if (!isAdmin || !monthRange(month)) return;
    const controller = new AbortController();
    setLoading(true); setError(''); setRecords([]); setLoadedSelection(''); setImageError('');
    const params = new URLSearchParams({ month, employee });
    fetch(`${endpoint}?${params}`, { cache: 'no-store', signal: controller.signal }).then(readResponse)
      .then((data) => { setRecords(data.records); setLoadedSelection(JSON.stringify([month, employee, revision])); setLoading(false); })
      .catch((err) => { if (err.name !== 'AbortError') { setError(err.message); setLoading(false); } });
    return () => controller.abort();
  }, [isAdmin, month, employee, revision]);

  const days = useMemo(() => calendarDays(month), [month]);
  const grouped = useMemo(() => {
    const result = new Map();
    for (const record of records) {
      if (!result.has(record.date)) result.set(record.date, []);
      result.get(record.date).push(record);
    }
    return result;
  }, [records]);
  const today = bangkokToday();
  const monthTitle = new Date(`${month}-01T00:00:00+07:00`).toLocaleDateString('th-TH', { timeZone: ATTENDANCE_TIME_ZONE, month: 'long', year: 'numeric' });
  const employeeTitle = employee ? employees.find((item) => item.value === employee)?.label || employeeLabel(records.find((item) => item.employee === employee) || { employee }) : 'พนักงานทั้งหมด';
  const canSaveImage = !loading && !error && loadedSelection === JSON.stringify([month, employee, revision]);
  const totalMinutes = records.reduce((sum, record) => sum + (durationMinutes(record) ?? 0), 0);
  async function saveImage() {
    if (!canSaveImage || savingImage) return;
    setSavingImage(true); setImageError('');
    try {
      const blob = await attendanceImage({ month, monthTitle, employeeTitle, records });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `attendance-${month}-${employeeTitle.replace(/[\\/:*?"<>|]/g, '_')}.png`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      setImageError(err.message || 'ไม่สามารถบันทึกรูปภาพได้ กรุณาลองใหม่');
    } finally {
      setSavingImage(false);
    }
  }
  function moveMonth(amount) {
    const [year, number] = month.split('-').map(Number);
    const next = new Date(Date.UTC(year, number - 1 + amount, 1)).toISOString().slice(0, 7);
    if (monthRange(next)) setMonth(next);
  }

  if (status === 'loading') return <p className="p-6">กำลังตรวจสอบสิทธิ์...</p>;
  if (!isAdmin) return <p className="p-6 text-red-700">เฉพาะผู้ดูแลระบบเท่านั้น กรุณาเข้าสู่ระบบด้วยบัญชี admin</p>;

  return <AdminLayout>
    <main className="min-w-0 space-y-5 text-gray-800">
      <header>
        <h1 className="text-2xl font-bold">ปฏิทินลงเวลาพนักงาน</h1>
        <p className="mt-1 text-sm text-gray-500">ตรวจสอบเวลาเข้า–ออกตามเดือนและพนักงาน · เวลาไทย (Asia/Bangkok)</p>
      </header>
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
        <label className="text-sm font-medium" htmlFor="attendance-month">เดือน
          <input id="attendance-month" type="month" min="1000-01" max="9999-12" value={month} onChange={(event) => { if (monthRange(event.target.value)) setMonth(event.target.value); }} className="mt-1 block rounded-lg border border-gray-300 p-2" />
        </label>
        <label className="min-w-0 text-sm font-medium" htmlFor="attendance-employee">พนักงาน
          <select id="attendance-employee" value={employee} onChange={(event) => setEmployee(event.target.value)} className="mt-1 block w-full max-w-sm rounded-lg border border-gray-300 bg-white p-2">
            <option value="">พนักงานทั้งหมด</option>
            {employees.map((item) => <option key={item.value} value={item.value}>{item.label} · {item.value}</option>)}
          </select>
        </label>
        <button onClick={() => setMonth(today.slice(0, 7))} className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">เดือนปัจจุบัน</button>
        <button onClick={() => setRevision((value) => value + 1)} disabled={loading} className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">โหลดใหม่</button>
        <button onClick={saveImage} disabled={!canSaveImage || savingImage} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-50">{savingImage ? 'กำลังสร้างรูปภาพ...' : 'บันทึกรูปทั้งเดือน (PNG)'}</button>
      </div>
      {imageError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{imageError}</p>}
      {optionsError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">โหลดรายชื่อพนักงานไม่สำเร็จ: {optionsError} <button className="underline" onClick={() => setRevision((value) => value + 1)}>ลองใหม่</button></p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-semibold">{monthTitle}</h2><p className="mt-1 text-sm text-gray-600">{employeeTitle}</p></div>
        <div className="flex gap-2">
          <button aria-label="เดือนก่อนหน้า" onClick={() => moveMonth(-1)} disabled={month === '1000-01'} className="rounded-lg border px-3 py-2 disabled:opacity-50">← ก่อนหน้า</button>
          <button aria-label="เดือนถัดไป" onClick={() => moveMonth(1)} disabled={month === '9999-12'} className="rounded-lg border px-3 py-2 disabled:opacity-50">ถัดไป →</button>
        </div>
      </div>
      <div aria-live="polite">
        {loading ? <p className="rounded-lg bg-blue-50 p-4 text-blue-700">กำลังโหลดข้อมูลลงเวลา...</p> : error ? <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-700">{error} <button className="underline" onClick={() => setRevision((value) => value + 1)}>ลองใหม่</button></p> : <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[['วันที่มีการลงเวลา', `${grouped.size} วัน`], ['รายการเข้า–ออก', `${records.length} รายการ`], ['ยังไม่ลงเวลาออก', `${records.filter((record) => !record.checkOutAt).length} รายการ`], ['ระยะเวลารวม', hours(totalMinutes)]].map(([label, value]) => <div key={label} className="rounded-xl border bg-white p-4"><p className="text-sm text-gray-500">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>)}
          </div>
          {!records.length && <p className="mb-4 rounded-lg bg-gray-50 p-4 text-gray-600">ไม่พบข้อมูลลงเวลาในเดือนและพนักงานที่เลือก</p>}
          <div className="overflow-x-auto rounded-xl border bg-white" tabIndex={0} role="region" aria-label="ปฏิทินลงเวลารายเดือน เลื่อนแนวนอนเพื่อดูทุกวัน">
            <table className="w-full min-w-[980px] table-fixed border-collapse">
              <thead><tr>{weekdays.map((day, index) => <th key={day} scope="col" className={`border-b bg-gray-50 p-3 text-center text-sm ${index === 0 || index === 6 ? 'text-red-600' : ''}`}>{day}</th>)}</tr></thead>
              <tbody>{Array.from({ length: days.length / 7 }, (_, week) => <tr key={week}>
                {days.slice(week * 7, week * 7 + 7).map((date, index) => <td key={date || `empty-${index}`} className={`h-36 border p-2 align-top ${!date ? 'bg-gray-50' : date === today ? 'bg-blue-50' : ''}`}>
                  {date && <>
                    <p className="mb-2 text-sm font-semibold"><time dateTime={date}>{Number(date.slice(-2))}</time>{date === today && <span className="ml-2 rounded bg-blue-600 px-2 py-0.5 text-xs text-white">วันนี้</span>}</p>
                    <div className="space-y-2">{grouped.get(date)?.map((record) => <AttendanceEntry key={record._id} record={record} />) || <p className="text-xs text-gray-400">ไม่มีรายการ</p>}</div>
                  </>}
                </td>)}
              </tr>)}</tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-gray-500">สีแดง: เข้างานหลัง 10:00 น. หรือออกก่อน 19:00 น. ของวันทำงาน ตามเวลาไทย · สีเขียว: ลงเวลาออกแล้ว · สีเหลือง: ยังไม่ลงเวลาออก · จัดวันตาม date ของรายการ · ระยะเวลารวมเฉพาะรายการที่เข้า–ออกครบและถูกต้อง ยังไม่หักเวลาพัก · ไม่มีรายการไม่ได้หมายถึงขาดงาน</p>
        </>}
      </div>
    </main>
  </AdminLayout>;
}

'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import AdminLayout from '../../components/AdminLayout';
import { calculateTotalCents } from '../../../../../lib/batch-records.mjs';

const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
const money = (n) => Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const localDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const stamp = (date) => new Date(date).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
const emptyRow = () => ({ time: '', customerName: '', idType: 'thai_id', idNumber: '', nationality: 'TH', currency: '', unit: '', amount: '', rate: '', payMethod: 'cash', receiveMethod: 'cash' });
const inputClass = 'border rounded p-2 w-full bg-white disabled:bg-gray-100';

export default function BatchRecordsPage() {
  const { data: session, status } = useSession();
  const [form, setForm] = useState({ date: localDate(), payType: 'Buying', employeeId: '', shiftId: '', cashMode: '', reason: '', rows: [emptyRow()] });
  const [options, setOptions] = useState({ users: [], currencies: [], shifts: [] });
  const [addCount, setAddCount] = useState(1);
  const [preview, setPreview] = useState(null);
  const [batchId, setBatchId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyError, setHistoryError] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [lookup, setLookup] = useState(null);

  useEffect(() => {
    if (session?.user?.role !== 'admin') return;
    const controller = new AbortController();
    const qs = new URLSearchParams({ date: form.date, employeeId: form.employeeId });
    fetch(`${base}/api/record/batch?${qs}`, { signal: controller.signal, cache: 'no-store' })
      .then(async (res) => { const data = await res.json(); if (!res.ok) throw new Error(data.message); return data; })
      .then(setOptions).catch((e) => { if (e.name !== 'AbortError') setMessage(e.message); });
    return () => controller.abort();
  }, [form.date, form.employeeId, session?.user?.role]);

  function change(key, value) {
    setForm((f) => ({ ...f, [key]: value, ...(['date', 'employeeId'].includes(key) ? { shiftId: '' } : {}) }));
    setPreview(null);
    setMessage('');
  }
  function rowChange(index, values) {
    setForm((f) => ({ ...f, rows: f.rows.map((r, i) => i === index ? { ...r, ...values } : r) }));
    setPreview(null);
    setMessage('');
  }
  async function findCustomer(index) {
    const row = form.rows[index];
    if (!row.idNumber.trim()) { setMessage(`บิลที่ ${index + 1}: กรอกเลขบัตร/พาสปอร์ตก่อนค้นหา`); return; }
    setLookup(index);
    try {
      const qs = new URLSearchParams({ idType: row.idType, idNumber: row.idNumber });
      const res = await fetch(`${base}/api/customers?${qs}`, { cache: 'no-store' });
      const data = await res.json();
      if (res.status === 404) { setMessage(`บิลที่ ${index + 1}: ไม่พบลูกค้าเดิม กรอกชื่อและสัญชาติเพื่อเพิ่มลูกค้าพร้อมบิลได้`); return; }
      if (!res.ok) throw new Error('ค้นหาลูกค้าไม่สำเร็จ');
      rowChange(index, { customerName: data.fullName, nationality: data.nationality, idNumber: data.idNumber });
    } catch (e) { setMessage(e.message); } finally { setLookup(null); }
  }
  async function submit(action) {
    setBusy(true); setMessage('');
    try {
      const res = await fetch(`${base}/api/record/batch`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, action, snapshot: preview?.snapshot, batchId }) });
      const data = await res.json();
      if (!res.ok) { if (res.status === 409) setPreview(null); throw new Error(data.message); }
      if (action === 'preview') { setPreview(data); setBatchId(crypto.randomUUID()); }
      else { setSaved(data.batch); setPreview(null); }
    } catch (e) { setMessage(e.message || 'เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง'); } finally { setBusy(false); }
  }
  async function loadHistory() {
    setHistoryLoading(true); setHistoryError('');
    try {
      const res = await fetch(`${base}/api/record/batch?history=1`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setHistory(data.batches);
    } catch (e) { setHistoryError(e.message); } finally { setHistoryLoading(false); }
  }
  const totals = form.rows.reduce((all, r) => {
    if (r.currency) all[r.currency] = (all[r.currency] || 0) + (Number(r.amount) || 0);
    return all;
  }, {});
  const settlementCurrency = options.users.find((u) => u._id === form.employeeId)?.country === 'Laos' ? 'LAK' : 'THB';
  const disabled = busy || !!saved || lookup !== null;
  if (status === 'loading') return <p className="p-6">กำลังโหลด...</p>;
  if (session?.user?.role !== 'admin') return <p className="p-6">เฉพาะผู้ดูแลระบบ <Link href="/login" className="text-blue-700 underline">เข้าสู่ระบบ</Link></p>;

  return <AdminLayout>
    <div className="max-w-6xl mx-auto space-y-6">
      <Link href="/admin/report/daily" className="text-blue-700 hover:underline">← กลับรายงานรายการ</Link>
      <div>
        <h1 className="text-2xl font-semibold">เพิ่มบิลย้อนหลังหลายรายการ</h1>
        <p className="mt-2 text-gray-600">กรอกยอดและเวลาทำรายการจริง (เวลาประเทศไทย) ระบบจะแทรกและเลื่อนเลขบิลภายในประเภท พนักงาน และวันเดียวกัน พร้อมเก็บประวัติเลขเดิม</p>
      </div>
      {message && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-red-800">{message}</p>}
      <fieldset disabled={disabled} className="space-y-5 disabled:opacity-70">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 border rounded p-4 bg-white">
          <label>วันที่ทำรายการ<input type="date" value={form.date} max={localDate()} onChange={(e) => change('date', e.target.value)} className={inputClass} /></label>
          <label>ประเภท<select value={form.payType} onChange={(e) => change('payType', e.target.value)} className={inputClass}><option>Buying</option><option>Selling</option></select></label>
          <label>พนักงาน / สาขา<select value={form.employeeId} onChange={(e) => change('employeeId', e.target.value)} className={inputClass}>
            <option value="">เลือกพนักงาน</option>{options.users.map((u) => <option key={u._id} value={u._id}>{u.name} / {u.branch} ({u.employeeCode})</option>)}
          </select></label>
          <label>กะที่ทำรายการ<select value={form.shiftId} onChange={(e) => change('shiftId', e.target.value)} className={inputClass}>
            <option value="">เลือกกะ</option>{options.shifts.map((s) => <option key={s._id} value={s._id}>กะ {s.shiftNo} — {s.closedAt ? 'ปิดแล้ว' : 'เปิดอยู่'}</option>)}
          </select></label>
          {form.employeeId && !options.shifts.length && <p className="sm:col-span-2 text-amber-800">ไม่พบกะในวันที่เลือก ต้องมีกะเดิมเพื่อผูกบิลย้อนหลัง</p>}
          <label className="sm:col-span-2">ยอดเงินของกะ<select value={form.cashMode} onChange={(e) => change('cashMode', e.target.value)} className={inputClass}>
            <option value="">เลือกวิธีจัดการยอดเงิน</option>
            <option value="already-accounted">ยอดนี้รวมในเงินของกะแล้ว — เพิ่มเฉพาะบิล</option>
            <option value="adjust-shift">ยอดนี้ยังไม่รวม — ปรับยอดเงินคงเหลือของกะที่เลือก</option>
          </select></label>
          <label className="sm:col-span-2">เหตุผลที่ลงบิลย้อนหลัง<input maxLength={1000} value={form.reason} onChange={(e) => change('reason', e.target.value)} className={inputClass} placeholder="เช่น หน้าร้านมีลูกค้าต่อเนื่อง จึงบันทึกภายหลัง" /></label>
          <p className="sm:col-span-2 lg:col-span-4 text-sm text-gray-600">การปรับยอดใช้วิธีรับ/จ่ายของแต่ละบิล และปรับเฉพาะกะที่เลือก ยอดนับปิดกะและยอดเปิดกะถัดไปยังคงเป็นยอดที่เคยนับจริง</p>
        </div>
        {form.rows.map((row, index) => <div key={index} className="border rounded bg-white p-4">
          <div className="flex justify-between items-center mb-3"><h2 className="font-semibold">บิลที่ {index + 1}</h2><button type="button" className="text-red-700 disabled:opacity-40" disabled={form.rows.length === 1} onClick={() => change('rows', form.rows.filter((_, i) => i !== index))}>ลบบิลนี้</button></div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            <label>เวลาทำรายการ<input type="time" step="1" value={row.time} onChange={(e) => rowChange(index, { time: e.target.value })} className={inputClass} /></label>
            <label>ประเภทเอกสาร<select value={row.idType} onChange={(e) => rowChange(index, { idType: e.target.value })} className={inputClass}><option value="thai_id">บัตรประชาชน</option><option value="passport">พาสปอร์ต</option></select></label>
            <label>เลขบัตร / พาสปอร์ต<input maxLength={64} value={row.idNumber} onChange={(e) => rowChange(index, { idNumber: e.target.value })} className={inputClass} /></label>
            <div className="flex items-end"><button type="button" onClick={() => findCustomer(index)} className="border border-blue-600 text-blue-700 rounded p-2">{lookup === index ? 'กำลังค้นหา...' : 'ค้นหาลูกค้าเดิม'}</button></div>
            <label className="sm:col-span-2">ชื่อผู้แลก<input maxLength={200} value={row.customerName} onChange={(e) => rowChange(index, { customerName: e.target.value })} className={inputClass} /></label>
            <label>สัญชาติ (เช่น TH, US)<input maxLength={2} value={row.nationality} onChange={(e) => rowChange(index, { nationality: e.target.value.toUpperCase() })} className={inputClass} /></label>
            <label>สกุลเงิน<select value={row.currency} onChange={(e) => rowChange(index, { currency: e.target.value })} className={inputClass}><option value="">เลือกสกุลเงิน</option>{options.currencies.filter((c) => c !== settlementCurrency).map((c) => <option key={c}>{c}</option>)}</select></label>
            <label>ชนิดธนบัตร (ถ้ามี)<input maxLength={30} value={row.unit} onChange={(e) => rowChange(index, { unit: e.target.value })} className={inputClass} /></label>
            <label>จำนวนเงินต่างประเทศ<input type="number" min="0.01" step="0.01" value={row.amount} onChange={(e) => rowChange(index, { amount: e.target.value })} className={inputClass} /></label>
            <label>เรท ({settlementCurrency} ต่อ 1 หน่วย)<input type="number" min="0" step="any" value={row.rate} onChange={(e) => rowChange(index, { rate: e.target.value })} className={inputClass} /></label>
            <div className="self-end p-2 bg-gray-50 rounded">ยอด {settlementCurrency} <strong>{money(calculateTotalCents(Number(row.amount), Number(row.rate)) / 100)}</strong></div>
            <label>ลูกค้าจ่าย ({form.payType === 'Buying' ? row.currency || 'เงินต่างประเทศ' : settlementCurrency})<select value={row.payMethod} onChange={(e) => rowChange(index, { payMethod: e.target.value })} className={inputClass}><option value="cash">เงินสด</option><option value="transfer">โอนเงิน</option></select></label>
            <label>ลูกค้ารับ ({form.payType === 'Buying' ? settlementCurrency : row.currency || 'เงินต่างประเทศ'})<select value={row.receiveMethod} onChange={(e) => rowChange(index, { receiveMethod: e.target.value })} className={inputClass}><option value="cash">เงินสด</option><option value="transfer">โอนเงิน</option></select></label>
          </div>
        </div>)}
        <div className="flex flex-wrap items-center gap-3">
          <label>จำนวนบิลที่จะเพิ่ม <input aria-label="จำนวนบิลที่จะเพิ่ม" type="number" min="1" max={100 - form.rows.length} value={addCount} onChange={(e) => setAddCount(Number(e.target.value))} className="border rounded p-2 w-20" /></label>
          <button type="button" disabled={!Number.isInteger(addCount) || addCount < 1 || addCount + form.rows.length > 100} onClick={() => change('rows', [...form.rows, ...Array.from({ length: addCount }, emptyRow)])} className="border rounded px-4 py-2 disabled:opacity-40">เพิ่มช่องกรอกบิล</button>
          <span className="text-sm text-gray-500">สูงสุด 100 บิลต่อครั้ง</span>
        </div>
        <div className="rounded border p-4 bg-blue-50"><strong>รวม {form.rows.length} บิล</strong>{Object.entries(totals).map(([currency, amount]) => <span key={currency} className="ml-4">{currency}: {money(amount)}</span>)}</div>
        <button type="button" onClick={() => submit('preview')} className="rounded bg-blue-700 text-white px-5 py-2">{busy ? 'กำลังตรวจสอบ...' : 'ตรวจสอบยอดและเลขบิลก่อนบันทึก'}</button>
      </fieldset>
      {preview && <section className="border rounded p-4 space-y-3">
        <h2 className="text-xl font-semibold">ตัวอย่างการแทรกบิล</h2>
        <p>เพิ่ม {form.rows.length} บิล · เลื่อนเลขเดิม {preview.plan.filter((p) => !p.isNew && p.oldNumber !== p.docNumber).length} บิล · รวม {money(preview.total)} {preview.settlementCurrency}</p>
        <p className="text-sm text-amber-800">เลขบิลที่เปลี่ยนจะแสดงตามตาราง ใบเสร็จที่เคยพิมพ์หรือส่งออกแล้วจะยังเป็นเลขเดิม กรุณาใช้ประวัติเลขเดิม → เลขใหม่เพื่อตรวจสอบ</p>
        <div className="overflow-x-auto max-h-96"><table className="w-full text-sm border"><thead className="bg-gray-100"><tr>{['รายการ', 'เวลาทำรายการ', 'เลขเดิม', 'เลขใหม่'].map((h) => <th key={h} className="p-2 text-left border">{h}</th>)}</tr></thead><tbody>
          {preview.plan.map((p) => <tr key={p.docNumber} className={p.isNew ? 'bg-green-50' : ''}><td className="border p-2">{p.isNew ? `เพิ่มบิลที่ ${p.index + 1}` : p.oldNumber !== p.docNumber ? 'เลื่อนเลข' : 'คงเดิม'}</td><td className="border p-2">{stamp(p.createdAt)}</td><td className="border p-2">{p.oldNumber || '—'}</td><td className="border p-2 font-medium">{p.docNumber}</td></tr>)}
        </tbody></table></div>
        <button type="button" disabled={disabled} onClick={() => submit('save')} className="bg-green-700 text-white rounded px-5 py-2 disabled:opacity-50">{busy ? 'กำลังบันทึก...' : 'ยืนยันบันทึกและเลื่อนเลขบิลตามตัวอย่าง'}</button>
      </section>}
      {saved && <section role="status" className="border border-green-300 bg-green-50 rounded p-4 space-y-2">
        <h2 className="font-semibold">บันทึกสำเร็จ {saved.inserted.length} บิล และเลื่อนเลข {saved.renumbered.length} บิล</h2>
        <p>บันทึกเมื่อ {stamp(saved.recordedAt)} โดย {saved.recordedBy}</p>
        <ul className="list-disc pl-5">{saved.inserted.map((r) => <li key={r._id}><Link className="text-blue-700 underline" href={`/admin/report/daily/dailylist/${r._id}`}>{r.docNumber}</Link> — {r.customerName} — {money(r.total)} {r.settlementCurrency || 'THB'}</li>)}</ul>
        <button type="button" onClick={() => { setSaved(null); setForm((f) => ({ ...f, rows: [emptyRow()] })); setBatchId(''); setMessage(''); }} className="border rounded px-4 py-2 bg-white">เพิ่มบิลชุดใหม่</button>
      </section>}
      <section className="border rounded p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-center"><h2 className="text-lg font-semibold">ประวัติการเพิ่มและเลื่อนเลขบิล</h2><button type="button" onClick={loadHistory} disabled={historyLoading} className="text-blue-700 underline">{historyLoading ? 'กำลังโหลด...' : 'แสดง / อัปเดต 30 ชุดล่าสุด'}</button></div>
        {historyError && <p role="alert" className="text-red-700">{historyError}</p>}
        {history.map((batch) => <details key={batch._id} className="border rounded p-3">
          <summary className="cursor-pointer">{stamp(batch.recordedAt)} · {batch.payType} · {batch.employee} / {batch.branch} · เพิ่ม {batch.inserted.length} บิล / เลื่อน {batch.renumbered.length} บิล</summary>
          <p className="mt-2">วันที่ทำรายการ {batch.date} · ผู้บันทึก {batch.recordedBy}</p><p>เหตุผล: {batch.reason}</p>
          <p>ยอดเงิน: {batch.cashMode === 'adjust-shift' ? 'ปรับยอดกะที่เลือก' : 'รวมในกะแล้ว เพิ่มเฉพาะบิล'}</p>
          <ul className="mt-2 list-disc pl-5">{batch.inserted.map((r) => <li key={r._id}>เพิ่ม <Link className="text-blue-700 underline" href={`/admin/report/daily/dailylist/${r._id}`}>{r.docNumber}</Link> · {stamp(r.createdAt)} · {money(r.total)} {r.settlementCurrency || 'THB'}</li>)}{batch.renumbered.map((r) => <li key={r.id}><Link className="text-blue-700 underline" href={`/admin/report/daily/dailylist/${r.id}`}>{r.oldNumber} → {r.docNumber}</Link></li>)}</ul>
        </details>)}
      </section>
    </div>
  </AdminLayout>;
}

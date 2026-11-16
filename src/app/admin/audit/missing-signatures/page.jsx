'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import AdminLayout from '../../components/AdminLayout';

const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
const endpoint = `${base}/api/audit/missing-signatures`;
const inputClass = 'w-full rounded border border-gray-300 bg-white p-2 disabled:bg-gray-100';
const buttonClass = 'rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50';
const typeName = (value) => ({ Buying: 'Buying (รับซื้อ)', Selling: 'Selling (ขาย)' }[value] || value || '-');
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const stamp = (value) => value ? new Date(value).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) : '-';
async function readResponse(res) {
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'ดำเนินการไม่สำเร็จ');
  return data;
}

function Pagination({ result, busy, onChange }) {
  if (!result || result.pages < 2) return null;
  return <div className="mt-4 flex items-center justify-end gap-3 text-sm">
    <button className="rounded border px-3 py-2 disabled:opacity-40" disabled={busy || result.page <= 1} onClick={() => onChange(result.page - 1)}>ก่อนหน้า</button>
    <span>หน้า {result.page} / {result.pages}</span>
    <button className="rounded border px-3 py-2 disabled:opacity-40" disabled={busy || result.page >= result.pages} onClick={() => onChange(result.page + 1)}>ถัดไป</button>
  </div>;
}

function SignatureDialog({ record, onClose, onSaved }) {
  const [mode, setMode] = useState('upload');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [source, setSource] = useState(null);
  const [history, setHistory] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const canvasRef = useRef(null);
  const strokeRef = useRef(null);
  const [hasDrawing, setHasDrawing] = useState(false);
  const [drawing, setDrawing] = useState(false);

  function drawPoint(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * canvas.width / rect.width, y: (e.clientY - rect.top) * canvas.height / rect.height };
  }

  function startStroke(e) {
    if (saving || strokeRef.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const point = drawPoint(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.fillStyle = '#111827';
    ctx.beginPath(); ctx.arc(point.x, point.y, 2.5, 0, Math.PI * 2); ctx.fill();
    strokeRef.current = { pointerId: e.pointerId, ...point };
    setHasDrawing(true); setDrawing(true); setError('');
  }

  function moveStroke(e) {
    const previous = strokeRef.current;
    if (!previous || previous.pointerId !== e.pointerId) return;
    e.preventDefault();
    const point = drawPoint(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.strokeStyle = '#111827'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(previous.x, previous.y); ctx.lineTo(point.x, point.y); ctx.stroke();
    strokeRef.current = { pointerId: e.pointerId, ...point };
  }

  function endStroke(e) {
    if (strokeRef.current?.pointerId !== e.pointerId) return;
    strokeRef.current = null;
    setDrawing(false);
  }

  function clearDrawing() {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    strokeRef.current = null;
    setHasDrawing(false); setDrawing(false); setError('');
  }

  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (mode !== 'saved') return;
    const controller = new AbortController();
    setLoading(true); setError(''); setHistory(null); setSource(null);
    const qs = new URLSearchParams({ recordId: record._id, page: String(page) });
    fetch(`${endpoint}?${qs}`, { cache: 'no-store', signal: controller.signal }).then(readResponse)
      .then(setHistory).catch((e) => { if (e.name !== 'AbortError') setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [mode, page, record._id]);

  function chooseFile(e) {
    const next = e.target.files?.[0];
    setError(''); setFile(null);
    if (!next) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(next.type) || !next.size || next.size > 2 * 1024 * 1024) {
      setError('เลือกภาพ PNG, JPEG หรือ WebP ขนาดไม่เกิน 2 MB'); e.target.value = ''; return;
    }
    setFile(next);
  }

  async function save(e) {
    e.preventDefault();
    if (saving || drawing || (mode === 'draw' ? !hasDrawing : mode === 'upload' ? !file : !source || loading)) return;
    setSaving(true); setError('');
    try {
      const body = new FormData();
      body.set('recordId', record._id);
      if (mode === 'upload') body.set('file', file);
      else if (mode === 'draw') {
        const blob = await new Promise((resolve) => canvasRef.current.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('ไม่สามารถสร้างภาพลายเซ็นได้ กรุณาลองอีกครั้ง');
        body.set('file', blob, 'signature.png');
        body.set('source', 'draw');
      }
      else body.set('sourceRecordId', source._id);
      await readResponse(await fetch(endpoint, { method: 'POST', body }));
      onSaved();
    } catch (e) { setError(e.message); setSaving(false); }
  }

  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
    <section role="dialog" aria-modal="true" aria-labelledby="signature-title" className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
      <div className="flex items-start justify-between gap-4">
        <div><h2 id="signature-title" className="text-xl font-bold">เพิ่มลายเซ็นลูกค้า</h2>
          <p className="mt-1 text-sm text-gray-600">{record.docNumber || 'ไม่มีเลขที่รายการ'} · {record.customerName || '-'} · รหัสเอกสาร {record.customerId || '-'}</p></div>
        <button type="button" autoFocus disabled={saving} onClick={onClose} className="rounded border px-3 py-1 disabled:opacity-50" aria-label="ปิดหน้าต่าง">ปิด</button>
      </div>
      <form onSubmit={save}>
        <fieldset disabled={saving || drawing} className="mt-5 flex flex-wrap gap-4">
          <label className="flex gap-2"><input type="radio" name="mode" checked={mode === 'draw'} onChange={() => { setMode('draw'); setError(''); }} />เซ็นบนหน้าจอ</label>
          <label className="flex gap-2"><input type="radio" name="mode" checked={mode === 'upload'} onChange={() => { setMode('upload'); setError(''); }} />อัปโหลดจากเครื่อง</label>
          <label className="flex gap-2"><input type="radio" name="mode" checked={mode === 'saved'} onChange={() => { setMode('saved'); setError(''); }} />ดึงลายเซ็นเก่า</label>
        </fieldset>
        <div className={mode === 'draw' ? 'mt-4' : 'hidden'}>
          <p id="signature-help" className="text-sm text-gray-600">ให้ลูกค้าใช้นิ้วหรือ Apple Pencil เซ็นในช่องด้านล่าง แล้วตรวจสอบก่อนกดยืนยันบันทึก</p>
          <div className="mt-3 overflow-hidden rounded border-2 border-gray-300 bg-white">
            <canvas ref={canvasRef} width={1400} height={500} aria-label="ช่องเซ็นลายเซ็นลูกค้า" aria-describedby="signature-help"
              className="block w-full" style={{ touchAction: 'none', userSelect: 'none', aspectRatio: '14 / 5' }}
              onPointerDown={startStroke} onPointerMove={moveStroke} onPointerUp={(e) => { moveStroke(e); endStroke(e); }} onPointerCancel={endStroke} onLostPointerCapture={endStroke} />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p role="status" className="text-sm text-gray-600">{hasDrawing ? 'มีลายเซ็นพร้อมบันทึก' : 'กรุณาเซ็นก่อนบันทึก'}</p>
            <button type="button" disabled={saving || drawing || !hasDrawing} onClick={clearDrawing} className="rounded border px-4 py-2 disabled:opacity-50">ล้างลายเซ็น</button>
          </div>
        </div>
        {mode === 'upload' && <div className="mt-4">
          <label className="block text-sm">ไฟล์ลายเซ็น (PNG, JPEG, WebP ไม่เกิน 2 MB)
            <input type="file" accept="image/png,image/jpeg,image/webp" disabled={saving} onChange={chooseFile} className="mt-2 block w-full rounded border p-3" />
          </label>
          {preview && <div className="mt-4 rounded border bg-gray-50 p-3"><p className="mb-2 text-sm text-gray-600">ภาพตัวอย่าง</p>{/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="ภาพตัวอย่างลายเซ็นที่จะบันทึก" className="h-40 w-full object-contain" /></div>}
        </div>}
        {mode === 'saved' && <div className="mt-4">
          <p className="text-sm text-gray-600">เลือกลายเซ็นจากรายการเดิมของลูกค้ารหัสเอกสารเดียวกัน แล้วตรวจสอบภาพก่อนบันทึก</p>
          {loading && <p className="py-6" role="status">กำลังค้นหาลายเซ็นเดิม...</p>}
          {history?.total === 0 && <div className="my-4 rounded bg-amber-50 p-3 text-amber-900">
            <p>{record.customerId ? 'ไม่พบลายเซ็นเดิมของลูกค้ารายนี้ สามารถเซ็นบนหน้าจอหรืออัปโหลดจากเครื่องได้' : 'รายการนี้ไม่มีรหัสเอกสารลูกค้า จึงไม่สามารถดึงลายเซ็นเดิมได้ สามารถเซ็นบนหน้าจอหรืออัปโหลดจากเครื่องได้'}</p>
            <button type="button" disabled={saving} className={`${buttonClass} mt-3`} onClick={() => { setMode('draw'); setError(''); }}>เซ็นบนหน้าจอ</button>
          </div>}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {history?.records.map((item) => <label key={item._id} className={`cursor-pointer rounded border p-3 ${source?._id === item._id ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}>
              <span className="flex items-center gap-2"><input type="radio" name="source" disabled={saving} checked={source?._id === item._id} onChange={() => setSource(item)} /><span className="font-medium">{item.docNumber || '-'}</span></span>
              <span className="mt-1 block text-xs text-gray-600">{item.customerName || '-'} · {item.branch || '-'} · {typeName(item.payType)}<br />{item.date || stamp(item.createdAt)}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${base}/api/record/${item._id}/signature/image`} alt={`ลายเซ็นจาก ${item.docNumber}`} className="mt-2 h-28 w-full bg-white object-contain" />
            </label>)}
          </div>
          <Pagination result={history} busy={loading || saving} onChange={setPage} />
        </div>}
        {error && <p role="alert" className="mt-4 rounded bg-red-50 p-3 text-red-700">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" disabled={saving} className="rounded border px-4 py-2 disabled:opacity-50" onClick={onClose}>ยกเลิก</button>
          <button className={buttonClass} disabled={saving || drawing || (mode === 'draw' ? !hasDrawing : mode === 'upload' ? !file : !source || loading)}>{saving ? 'กำลังบันทึก...' : 'ยืนยันบันทึกลายเซ็น'}</button>
        </div>
      </form>
    </section>
  </div>;
}

export default function MissingSignaturesPage() {
  const { data: session, status } = useSession();
  const [filters, setFilters] = useState({ branch: '', payType: '', date: today() });
  const [options, setOptions] = useState({ branches: [], payTypes: [] });
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (session?.user?.role !== 'admin') return;
    const controller = new AbortController();
    fetch(`${endpoint}?options=1`, { cache: 'no-store', signal: controller.signal }).then(readResponse).then(setOptions)
      .catch((e) => { if (e.name !== 'AbortError') setOptionsError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setOptionsLoading(false); });
    return () => controller.abort();
  }, [session?.user?.role]);

  async function check(page = 1) {
    setBusy(true); setError(''); setResult(null);
    try {
      const qs = new URLSearchParams({ ...filters, page: String(page) });
      setResult(await readResponse(await fetch(`${endpoint}?${qs}`, { cache: 'no-store' })));
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  function change(key, value) {
    setFilters((previous) => ({ ...previous, [key]: value })); setResult(null); setError(''); setMessage('');
  }
  function saved() {
    setSelected(null); setMessage('บันทึกลายเซ็นลูกค้าเรียบร้อยแล้ว');
    check(Math.max(1, Math.min(result.page, Math.ceil((result.total - 1) / 20))));
  }

  if (status === 'loading') return <p className="p-6">กำลังโหลด...</p>;
  if (session?.user?.role !== 'admin') return <p className="p-6">สำหรับผู้ดูแลระบบเท่านั้น</p>;
  return <AdminLayout>
    <div className="mx-auto max-w-6xl space-y-5">
      <div><h1 className="text-2xl font-bold">ตรวจสอบลายเซ็นลูกค้า</h1><p className="mt-1 text-sm text-gray-600">ค้นหารายการที่ยังไม่มีภาพลายเซ็นลูกค้า โดยเลือกตรวจสอบทีละวัน</p></div>
      <form className="grid items-end gap-4 rounded-xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(e) => { e.preventDefault(); setMessage(''); check(); }}>
        <label className="text-sm">สาขา<select className={`${inputClass} mt-1`} value={filters.branch} disabled={busy || optionsLoading} onChange={(e) => change('branch', e.target.value)}><option value="">ทุกสาขา</option>{options.branches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}</select></label>
        <label className="text-sm">ประเภทรายการ<select className={`${inputClass} mt-1`} value={filters.payType} disabled={busy || optionsLoading} onChange={(e) => change('payType', e.target.value)}><option value="">ทุกประเภท</option>{options.payTypes.map((type) => <option key={type} value={type}>{typeName(type)}</option>)}</select></label>
        <label className="text-sm">วันที่ (เวลาไทย)<input type="date" required className={`${inputClass} mt-1`} value={filters.date} disabled={busy} onChange={(e) => change('date', e.target.value)} /></label>
        <button className={buttonClass} disabled={busy || !filters.date}>{busy ? 'กำลังตรวจสอบ...' : 'ตรวจสอบ'}</button>
      </form>
      {optionsError && <p role="alert" className="text-red-700">โหลดตัวเลือกไม่สำเร็จ: {optionsError} กรุณาโหลดหน้าใหม่</p>}
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-700">{error}</p>}
      {message && <p role="status" className="rounded bg-green-50 p-3 text-green-800">{message}</p>}
      {result && <section className="rounded-xl border bg-white p-4">
        <h2 className="mb-3 font-semibold">รายการที่ไม่มีลายเซ็นลูกค้า {result.total.toLocaleString('th-TH')} รายการ</h2>
        {result.total === 0 ? <p className="py-8 text-center text-gray-500">ไม่พบรายการที่ไม่มีลายเซ็นตามเงื่อนไขที่เลือก</p> : <div className="overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-sm">
          <thead className="bg-gray-50"><tr>{['เลขที่รายการ', 'ลูกค้า / รหัสเอกสาร', 'สาขา', 'ประเภท', 'วันที่', 'ยอดรวม', 'จัดการ'].map((title) => <th key={title} className="p-3">{title}</th>)}</tr></thead>
          <tbody>{result.records.map((record) => <tr key={record._id} className="border-t">
            <td className="p-3"><Link target="_blank" rel="noopener noreferrer" className="text-blue-700 underline" href={`${base}/admin/report/daily/dailylist/${record._id}`}>{record.docNumber || 'ดูรายการ'}</Link></td>
            <td className="p-3">{record.customerName || '-'}<div className="text-xs text-gray-500">{record.customerId || 'ไม่มีรหัสเอกสาร'}</div></td>
            <td className="p-3">{record.branch || '-'}</td><td className="p-3">{typeName(record.payType)}</td>
            <td className="p-3">{record.date || stamp(record.createdAt)}</td><td className="p-3 text-right">{Number(record.total || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td className="p-3"><button className={buttonClass} onClick={() => setSelected(record)}>เพิ่มลายเซ็น</button></td>
          </tr>)}</tbody>
        </table></div>}
        <Pagination result={result} busy={busy} onChange={check} />
      </section>}
      {!result && !busy && !error && <p className="py-8 text-center text-gray-500">เลือกเงื่อนไขแล้วกดตรวจสอบ</p>}
    </div>
    {selected && <SignatureDialog record={selected} onClose={() => setSelected(null)} onSaved={saved} />}
  </AdminLayout>;
}

export function calculateTotalCents(amount, rate) {
  if (!Number.isFinite(amount) || !Number.isFinite(rate) || amount < 0 || rate < 0) return NaN;
  if (!Number.isSafeInteger(Math.round(amount * 100))) return NaN;
  const [coefficient, exponent = '0'] = String(rate).split('e');
  const [whole, fraction = ''] = coefficient.split('.');
  const scale = fraction.length - Number(exponent);
  let numerator = BigInt(Math.round(amount * 100)) * BigInt(whole + fraction);
  const denominator = scale > 0 ? 10n ** BigInt(scale) : 1n;
  if (scale < 0) numerator *= 10n ** BigInt(-scale);
  return Number((numerator + denominator / 2n) / denominator);
}

export function validateBatch(input, now = new Date()) {
  const fail = (message) => { throw new Error(message); };
  if (!input || !['Buying', 'Selling'].includes(input.payType)) fail('เลือก Buying หรือ Selling');
  if (!/^[a-f\d]{24}$/i.test(input.employeeId || '') || !/^[a-f\d]{24}$/i.test(input.shiftId || '')) fail('เลือกพนักงานและกะ');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date || '')) fail('วันที่ไม่ถูกต้อง');
  if (!['already-accounted', 'adjust-shift'].includes(input.cashMode)) fail('ระบุวิธีจัดการยอดเงินของกะ');
  const reason = String(input.reason || '').trim();
  if (!reason || reason.length > 1000) fail('ระบุเหตุผลการบันทึกย้อนหลัง (ไม่เกิน 1,000 ตัวอักษร)');
  if (!Array.isArray(input.rows) || input.rows.length < 1 || input.rows.length > 100) fail('เพิ่มได้ครั้งละ 1–100 บิล');
  const rows = input.rows.map((r, index) => {
    const error = (message) => fail(`บิลที่ ${index + 1}: ${message}`);
    if (!/^\d{2}:\d{2}(:\d{2})?$/.test(r.time || '')) error('ระบุเวลาให้ถูกต้อง');
    const timestamp = `${input.date}T${r.time.length === 5 ? `${r.time}:00` : r.time}+07:00`;
    const createdAt = new Date(timestamp);
    if (!Number.isFinite(createdAt.getTime()) || new Date(createdAt.getTime() + 7 * 3600000).toISOString().slice(0, 19) !== timestamp.slice(0, 19)) error('วันเวลาไม่ถูกต้อง');
    if (createdAt > now) error('เวลาทำรายการต้องไม่อยู่ในอนาคต');
    const customerName = String(r.customerName || '').replace(/\s+/g, ' ').trim();
    const idNumber = String(r.idNumber || '').replace(/[\s-]+/g, '').toUpperCase();
    const nationality = String(r.nationality || '').trim().toUpperCase();
    if (!customerName || customerName.length > 200) error('กรอกชื่อผู้แลกไม่เกิน 200 ตัวอักษร');
    if (!['thai_id', 'passport'].includes(r.idType) || idNumber.length < 4 || idNumber.length > 64) error('กรอกประเภทและเลขเอกสาร');
    if (r.idType === 'thai_id' && !/^\d{13}$/.test(idNumber)) error('เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก');
    if (!/^[A-Z]{2}$/.test(nationality)) error('สัญชาติต้องเป็นรหัสประเทศ 2 ตัวอักษร');
    const currency = String(r.currency || '').trim();
    if (!currency || currency.length > 30 || /[.$]/.test(currency) || ['__proto__', 'constructor', 'prototype'].includes(currency)) error('สกุลเงินไม่ถูกต้อง');
    const amount = Number(r.amount), rate = Number(r.rate);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.001) error('จำนวนเงินต้องมากกว่า 0 และมีทศนิยมไม่เกิน 2 ตำแหน่ง');
    if (!Number.isFinite(rate) || rate <= 0 || rate > 1e8) error('อัตราแลกเปลี่ยนต้องมากกว่า 0');
    const totalCents = calculateTotalCents(amount, rate);
    if (!Number.isSafeInteger(totalCents) || totalCents <= 0) error('ยอดเงินบาทไม่ถูกต้อง');
    if (![r.payMethod, r.receiveMethod].every((m) => ['cash', 'transfer'].includes(m))) error('เลือกวิธีจ่ายและรับเงิน');
    return { customerName, idNumber, nationality, idType: r.idType, currency, amount, rate, total: totalCents / 100,
      time: r.time, createdAt: createdAt.toISOString(), payMethod: r.payMethod, receiveMethod: r.receiveMethod,
      unit: String(r.unit || '').trim().slice(0, 30) };
  });
  if (!Number.isSafeInteger(rows.reduce((sum, row) => sum + Math.round(row.total * 100), 0))) fail('ยอดรวมทั้งชุดสูงเกินขอบเขตที่รองรับ');
  return { date: input.date, payType: input.payType, employeeId: input.employeeId, shiftId: input.shiftId, cashMode: input.cashMode, reason, rows };
}

// Every insertion moves all later existing numbers down by one; earlier numbers stay unchanged.
export function planNumbers(existing, rows, stem) {
  const old = existing.map((r) => {
    const suffix = r.docNumber.slice(stem.length);
    if (!r.docNumber.startsWith(stem) || !/^\d{3,}$/.test(suffix) || Number(suffix) < 1) throw new Error('รูปแบบเลขบิลเดิมไม่รองรับการแทรก');
    return { ...r, sequence: Number(suffix), id: String(r._id), timeValue: new Date(r.createdAt).getTime(), isNew: false };
  }).sort((a, b) => a.timeValue - b.timeValue || a.sequence - b.sequence);
  old.forEach((r, i) => {
    if (!Number.isFinite(r.timeValue) || (i > 0 && r.sequence <= old[i - 1].sequence)) throw new Error('เลขบิลเดิมซ้ำหรือไม่เรียงตามเวลา กรุณาตรวจสอบก่อนแทรก');
  });
  const combined = [...old, ...rows.map((r, index) => ({ ...r, index, isNew: true, timeValue: new Date(r.createdAt).getTime() }))]
    .sort((a, b) => a.timeValue - b.timeValue || Number(a.isNew) - Number(b.isNew) || (a.index ?? a.sequence) - (b.index ?? b.sequence));
  let next = 1;
  let insertedCount = 0;
  return combined.map((r) => {
    const sequence = r.isNew ? next : r.sequence + insertedCount;
    if (r.isNew) insertedCount += 1;
    next = sequence + 1;
    return { id: r.id, index: r.index, isNew: r.isNew, oldNumber: r.isNew ? null : r.docNumber,
      docNumber: `${stem}${String(sequence).padStart(3, '0')}`, sequence, createdAt: new Date(r.timeValue).toISOString() };
  });
}

export function cashChanges(row, payType, settlementCurrency = 'THB') {
  const changes = [];
  const buying = payType === 'Buying';
  if ((buying ? row.payMethod : row.receiveMethod) === 'cash') changes.push({ currency: row.currency, delta: row.amount * (buying ? 1 : -1) });
  if ((buying ? row.receiveMethod : row.payMethod) === 'cash') changes.push({ currency: settlementCurrency, delta: row.total * (buying ? -1 : 1) });
  return changes;
}

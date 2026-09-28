import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { createHash } from 'crypto';
import mongoose from 'mongoose';
import { connectMongoDB } from '../../../../../lib/mongodb';
import { withRecordNumbering } from '../../../../../lib/record-numbering';
import { validateBatch, planNumbers, cashChanges } from '../../../../../lib/batch-records.mjs';
import Record from '../../../../../models/record';
import RecordBatch from '../../../../../models/recordBatch';
import Counter from '../../../../../models/counter';
import User from '../../../../../models/user';
import Shift from '../../../../../models/shift';
import Customer from '../../../../../models/Customer';
import Post from '../../../../../models/post';
import AdjustmentLog from '../../../../../models/adjustmentLog';
import Notification from '../../../../../models/notifications';

export const dynamic = 'force-dynamic';

const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function problem(message, status = 400) { const error = new Error(message); error.status = status; throw error; }
async function authorize(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) problem('กรุณาเข้าสู่ระบบ', 401);
  if (token.role !== 'admin') problem('เฉพาะผู้ดูแลระบบ', 403);
  return token;
}
function failure(error) {
  if (error.code === 20 || /Transaction numbers are only allowed/.test(error.message)) return NextResponse.json({ message: 'ฐานข้อมูลต้องรองรับ transaction (MongoDB replica set) จึงจะบันทึกและเลื่อนเลขบิลพร้อมกันได้' }, { status: 503 });
  return NextResponse.json({ message: error.status ? error.message : 'บันทึกไม่สำเร็จ ไม่มีการบันทึกบางส่วน กรุณาลองอีกครั้ง' }, { status: error.status || 500 });
}
export async function GET(req) {
  try {
    await authorize(req);
    await connectMongoDB();
    const params = new URL(req.url).searchParams;
    if (params.get('history') === '1') {
      const batches = await RecordBatch.find({}).sort({ recordedAt: -1 }).limit(30).lean();
      return NextResponse.json({ batches });
    }
    const users = await User.find({ employeeCode: { $exists: true, $ne: '' } }).select('name employeeCode branch country').sort({ name: 1 }).lean();
    const currencies = await Post.distinct('title');
    let shifts = [];
    if (params.get('date') && mongoose.isValidObjectId(params.get('employeeId'))) {
      const employee = users.find((u) => String(u._id) === params.get('employeeId'));
      if (employee) shifts = await Shift.find({ date: params.get('date'), employee: employee.name, branch: employee.branch, isDeleted: { $ne: true } }).select('date shiftNo createdAt closedAt branch').sort({ createdAt: 1 }).lean();
    }
    return NextResponse.json({ users, currencies, shifts });
  } catch (error) { return failure(error); }
}

async function prepare(input, session = null) {
  const employee = await User.findById(input.employeeId).session(session).lean();
  if (!employee || !employee.branch || !/^[A-Za-z0-9]+$/.test(employee.employeeCode || '')) problem('ข้อมูลพนักงาน สาขา หรือรหัสพนักงานไม่ครบ');
  if (await User.countDocuments({ employeeCode: employee.employeeCode }).session(session) !== 1) problem('รหัสพนักงานซ้ำ กรุณาแก้ไขก่อนแทรกบิล');
  const shift = await Shift.findOne({ _id: input.shiftId, employee: employee.name, branch: employee.branch, date: input.date, isDeleted: { $ne: true } }).session(session).lean();
  if (!shift) problem('ไม่พบกะของพนักงานในวันที่เลือก');
  const currencies = await Post.distinct('title').session(session);
  const settlementCurrency = employee.country === 'Laos' ? 'LAK' : 'THB';
  for (const row of input.rows) {
    if (row.currency === settlementCurrency) problem('สกุลเงินที่แลกต้องต่างจากสกุลเงินรับชำระ');
    if (!currencies.includes(row.currency)) problem(`ไม่พบสกุลเงิน ${row.currency} ในระบบ`);
    if (new Date(row.createdAt) < new Date(shift.createdAt) || (shift.closedAt && new Date(row.createdAt) > new Date(shift.closedAt))) problem('เวลาทำรายการต้องอยู่ภายในช่วงเปิด–ปิดของกะที่เลือก');
  }
  const prefix = input.payType === 'Buying' ? 'B' : 'S';
  const dateCode = input.date.slice(2).replaceAll('-', '');
  const stem = `${prefix}-${employee.employeeCode}-${dateCode}`;
  const existing = await Record.find({ docNumber: { $regex: `^${stem}\\d+$` } }).select('_id docNumber createdAt branch employee payType').sort({ docNumber: 1 }).session(session).lean();
  if (existing.some((r) => r.branch !== employee.branch || r.employee !== employee.name || r.payType !== input.payType)) problem('ชุดเลขบิลนี้มีรายการต่างสาขาหรือพนักงาน กรุณาตรวจสอบก่อนแทรก');
  let plan;
  try { plan = planNumbers(existing, input.rows, stem); } catch (error) { problem(error.message); }
  const counters = await Counter.find({ date: dateCode, prefix: `${prefix}-${employee.employeeCode}` }).session(session).lean();
  if (counters.length > 1) problem('พบตัวนับเลขบิลซ้ำ กรุณาตรวจสอบก่อนแทรก');
  const snapshot = hash({ input, employee, shift, existing, counters });
  return { employee, shift, plan, snapshot, dateCode, prefix, existing, settlementCurrency };
}

export async function POST(req) {
  try {
    const token = await authorize(req);
    const body = await req.json();
    let input;
    try { input = validateBatch(body); } catch (error) { problem(error.message); }
    await connectMongoDB();
    if (body.action === 'preview') {
      const prepared = await prepare(input);
      return NextResponse.json({ settlementCurrency: prepared.settlementCurrency, snapshot: prepared.snapshot, plan: prepared.plan, total: input.rows.reduce((s, r) => s + Math.round(r.total * 100), 0) / 100 });
    }
    if (body.action !== 'save' || !/^[a-f\d-]{36}$/i.test(body.batchId || '') || !body.snapshot) problem('กรุณาตรวจสอบตัวอย่างก่อนบันทึก');
    const payloadHash = hash(input);
    const actor = token.email || token.name || token.sub;
    const result = await withRecordNumbering(async (session) => {
      const previous = await RecordBatch.findById(body.batchId).session(session).lean();
      if (previous) {
        if (previous.payloadHash !== payloadHash || previous.recordedBy !== actor) problem('รหัสชุดบันทึกนี้ถูกใช้งานแล้ว', 409);
        return previous;
      }
      const { employee, shift, plan, snapshot, dateCode, prefix, settlementCurrency } = await prepare(input, session);
      if (snapshot !== body.snapshot) problem('ข้อมูลหรือเลขบิลเปลี่ยนหลังเปิดตัวอย่าง กรุณาตรวจสอบตัวอย่างใหม่', 409);
      const recordedAt = new Date();
      const changed = plan.filter((p) => !p.isNew && p.oldNumber !== p.docNumber);
      // Customer updates, inserts, references, counters and audit are committed together.
      for (const row of input.rows) {
        const customer = await Customer.findOne({ idNumber: row.idNumber }).session(session);
        if (customer) {
          if (customer.idType !== row.idType || customer.fullName !== row.customerName || customer.nationality !== row.nationality) problem(`ข้อมูลผู้แลก ${row.customerName} ไม่ตรงกับเลขเอกสารที่มีอยู่ กรุณาตรวจสอบข้อมูลลูกค้า`);
        } else {
          await Customer.create([{ fullName: row.customerName, idNumber: row.idNumber, idType: row.idType, nationality: row.nationality, branch: employee.branch, createdBy: actor, dataCollectedAt: recordedAt }], { session });
        }
      }
      // A single update pipeline reads each reference's original value, avoiding cascading renames.
      if (changed.length) {
        for (const model of [AdjustmentLog, Notification]) {
          await model.updateMany({ docNumber: { $in: changed.map((p) => p.oldNumber) } }, [{ $set: { docNumber: { $switch: {
            branches: changed.map((p) => ({ case: { $eq: ['$docNumber', p.oldNumber] }, then: p.docNumber })), default: '$docNumber',
          } } } }], { session });
        }
        // Temporary numbers also work when a deployment has a unique docNumber index.
        await Record.bulkWrite(changed.map((p) => ({ updateOne: { filter: { _id: p.id }, update: { $set: { docNumber: `pending-${body.batchId}-${p.id}` } } } })), { session });
        await Record.bulkWrite(changed.map((p) => ({ updateOne: { filter: { _id: p.id }, update: {
          $set: { docNumber: p.docNumber },
          $push: { docNumberHistory: { from: p.oldNumber, to: p.docNumber, changedAt: recordedAt, changedBy: actor, reason: input.reason, batchId: body.batchId } },
        } } })), { session });
      }
      const documents = plan.filter((p) => p.isNew).map((p) => {
        const row = input.rows[p.index];
        return { docNumber: p.docNumber, date: input.date, createdAt: row.createdAt, recordedAt, recordedBy: actor, batchId: body.batchId, batchCashMode: input.cashMode, batchShiftId: shift._id, settlementCurrency,
          employee: employee.name, employeeCode: employee.employeeCode, branch: employee.branch, shiftNo: String(shift.shiftNo),
          customerName: row.customerName, customerId: row.idNumber, payType: input.payType,
          payMethod: row.payMethod, receiveMethod: row.receiveMethod, total: row.total, note: input.reason,
          items: [{ currency: row.currency, unit: row.unit, amount: row.amount, rate: row.rate, total: row.total }] };
      });
      const inserted = await Record.insertMany(documents, { session });
      if (input.cashMode === 'adjust-shift') {
        const balance = { ...shift.cashBalance };
        const logs = [];
        for (const record of inserted) {
          const row = { ...record.items[0].toObject(), total: record.total, payMethod: record.payMethod, receiveMethod: record.receiveMethod };
          for (const change of cashChanges(row, input.payType, settlementCurrency)) {
            const before = Number(balance[change.currency] || 0);
            if (!Number.isFinite(before)) problem('ยอดเงินในกะไม่ถูกต้อง');
            const after = Math.round((before + change.delta) * 100) / 100;
            balance[change.currency] = after;
            logs.push({ docNumber: record.docNumber, shiftNo: String(shift.shiftNo), employee: employee.name, createdAt: recordedAt,
              action: change.delta > 0 ? 'increase' : 'decrease', currency: change.currency, amount: Math.abs(change.delta), beforeAmount: before, afterAmount: after });
          }
        }
        await Shift.updateOne({ _id: shift._id }, { $set: { cashBalance: balance, updatedAt: recordedAt }, $push: { editLogs: { action: 'batch-records', batchId: body.batchId, at: recordedAt, by: actor, reason: input.reason, before: shift.cashBalance, after: balance } } }, { session });
        if (logs.length) await AdjustmentLog.insertMany(logs, { session });
      }
      await Counter.updateOne({ date: dateCode, prefix: `${prefix}-${employee.employeeCode}` }, { $max: { count: Math.max(...plan.map((p) => p.sequence)) } }, { upsert: true, session });
      const [audit] = await RecordBatch.create([{ _id: body.batchId, payloadHash, recordedAt, recordedBy: actor, reason: input.reason,
        date: input.date, payType: input.payType, employee: employee.name, branch: employee.branch, cashMode: input.cashMode, shiftId: shift._id,
        inserted: inserted.map((r) => r.toObject()), renumbered: changed,
      }], { session });
      return audit.toObject();
    });
    return NextResponse.json({ batch: result }, { status: 201 });
  } catch (error) { return failure(error); }
}

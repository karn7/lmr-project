import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import mongoose from 'mongoose';
import Record from '../../../../../models/record';
import { withRecordNumbering } from '../../../../../lib/record-numbering';

function problem(message, status = 400) { const error = new Error(message); error.status = status; throw error; }
export async function POST(req) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) problem('กรุณาเข้าสู่ระบบ', 401);
    if (token.role !== 'admin') problem('เฉพาะผู้ดูแลระบบ', 403);
    const { changes, branch } = await req.json();
    if (branch !== 'Asawann' || !Array.isArray(changes) || !changes.length || changes.length > 5000) problem('บันทึกได้ครั้งละ 1–5,000 รายการของสาขา Asawann');
    const keys = new Set();
    for (const change of changes) {
      const key = `${change.recordId}:${change.itemId}`;
      if (!mongoose.isValidObjectId(change.recordId) || !mongoose.isValidObjectId(change.itemId) || keys.has(key) ||
          typeof change.rate !== 'number' || !Number.isFinite(change.rate) || change.rate <= 0 || change.rate > 1e8) problem('รายการหรืออัตราแลกเปลี่ยนไม่ถูกต้อง');
      keys.add(key);
    }
    const items = await withRecordNumbering(async session => {
      const records = await Record.find({ _id: { $in: [...new Set(changes.map(c => c.recordId))] }, branch, payType: { $in: ['Buying', 'Selling', 'Wholesale'] } }).session(session);
      const byId = new Map(records.map(record => [String(record._id), record]));
      const updated = [];
      for (const change of changes) {
        const record = byId.get(change.recordId);
        const item = record?.items.id(change.itemId);
        if (!item || record.docNumber !== change.expectedDocNumber || item.rate !== change.expectedRate || item.amount !== change.expectedAmount || item.total !== change.expectedTotal) problem('ข้อมูลเปลี่ยนแล้ว กรุณาโหลดรายงานใหม่ก่อนแก้ไข ไม่มีการบันทึกบางส่วน', 409);
        const total = item.amount * change.rate;
        if (!Number.isFinite(total)) problem('ยอดรวมไม่ถูกต้อง');
        item.rate = change.rate;
        item.total = total;
        updated.push({ recordId: change.recordId, itemId: change.itemId, rate: item.rate, total });
      }
      for (const record of records) {
        record.total = record.items.reduce((sum, item) => sum + item.total, 0);
        if (!Number.isFinite(record.total)) problem('ยอดรวมบิลไม่ถูกต้อง');
        await record.save({ session });
      }
      return updated;
    });
    return NextResponse.json({ success: true, items });
  } catch (error) {
    return NextResponse.json({ message: error.status ? error.message : 'บันทึกไม่สำเร็จ ไม่มีการบันทึกบางส่วน กรุณาลองอีกครั้ง' }, { status: error.status || 500 });
  }
}

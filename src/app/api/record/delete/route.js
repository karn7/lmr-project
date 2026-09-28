import Record from '../../../../../models/record';
import RecordBatch from '../../../../../models/recordBatch';
import Shift from '../../../../../models/shift';
import DeleteLog from '../../../../../models/deleteLog';
import AdjustmentLog from '../../../../../models/adjustmentLog';
import { withRecordNumbering } from '../../../../../lib/record-numbering';
import { cashChanges } from '../../../../../lib/batch-records.mjs';
import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function POST(req) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    if (token.role !== 'admin') return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    const { docNumber, recordId } = await req.json();
    const result = await withRecordNumbering(async (session) => {
      const record = await Record.findOne(recordId ? { _id: recordId } : { docNumber }).session(session);
      if (!record) return { status: 404, message: 'ไม่พบรายการ' };
      if (record.docNumber !== docNumber) return { status: 409, message: 'เลขบิลเปลี่ยนแล้ว กรุณาโหลดรายการใหม่ก่อนลบ' };
      if (record.batchId && record.batchCashMode === 'adjust-shift') {
        const batch = await RecordBatch.findById(record.batchId).session(session).lean();
        const original = batch?.inserted.find((r) => String(r._id) === String(record._id));
        const shift = await Shift.findById(record.batchShiftId).session(session);
        if (!shift || !original) return { status: 409, message: 'ไม่พบข้อมูลกะหรือประวัติยอดเดิม กรุณาตรวจสอบก่อนลบ' };
        const balance = { ...shift.cashBalance };
        const logs = [];
        for (const item of original.items) {
          for (const change of cashChanges({ ...item, total: item.total, payMethod: original.payMethod, receiveMethod: original.receiveMethod }, original.payType, original.settlementCurrency || 'THB')) {
            const beforeAmount = Number(balance[change.currency] || 0);
            const afterAmount = Math.round((beforeAmount - change.delta) * 100) / 100;
            balance[change.currency] = afterAmount;
            logs.push({ docNumber, shiftNo: record.shiftNo, employee: record.employee, action: change.delta > 0 ? 'decrease' : 'increase', currency: change.currency, amount: Math.abs(change.delta), beforeAmount, afterAmount });
          }
        }
        shift.editLogs.push({ action: 'delete-batch-record', recordId: record._id, docNumber, at: new Date(), by: token.email || token.name, before: shift.cashBalance, after: balance });
        shift.cashBalance = balance;
        await shift.save({ session });
        if (logs.length) await AdjustmentLog.insertMany(logs, { session });
      }
      await DeleteLog.create([{ docNumber, deletedAt: new Date(), deletedBy: token.name || token.email || 'admin', deletedData: record.toObject() }], { session });
      await Record.deleteOne({ _id: record._id }, { session });
      return { status: 200, message: 'ลบเรียบร้อย' };
    });
    return NextResponse.json({ message: result.message }, { status: result.status });
  } catch (error) {
    console.error('Error deleting record:', error);
    return NextResponse.json({ message: 'เกิดข้อผิดพลาดในการลบรายการ' }, { status: 500 });
  }
}

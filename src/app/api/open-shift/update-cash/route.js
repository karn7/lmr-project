import { NextResponse } from 'next/server';
import Shift from '../../../../../models/shift';
import Record from '../../../../../models/record';
import AdjustmentLog from '../../../../../models/adjustmentLog';
import { withRecordNumbering } from '../../../../../lib/record-numbering';

export async function POST(req) {
  try {
    const { docNumber, recordId, totalTHB, totalLAK, currency, amount, action, shiftNo, employee } = await req.json();
    if (!['increase', 'decrease'].includes(action)) return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
    const changes = [];
    if (totalTHB !== undefined) changes.push({ currency: 'THB', amount: Number(totalTHB) });
    if (totalLAK !== undefined) changes.push({ currency: 'LAK', amount: Number(totalLAK) });
    if (currency && amount !== undefined) changes.push({ currency, amount: Number(amount) });
    if (!changes.length || changes.some((c) => !Number.isFinite(c.amount) || c.amount < 0 || !c.currency || /[.$]/.test(c.currency) || ['__proto__', 'constructor', 'prototype'].includes(c.currency))) {
      return NextResponse.json({ message: 'Invalid cash amount or currency' }, { status: 400 });
    }
    const result = await withRecordNumbering(async (session) => {
      // Use the immutable ID when a backdated insertion has moved the document number.
      const record = recordId ? await Record.findById(recordId).session(session) : null;
      if (recordId && !record) return { status: 404, message: 'Record not found' };
      const currentDocNumber = record?.docNumber || docNumber;
      const shift = await Shift.findOne({ date: new Date().toISOString().slice(0, 10), shiftNo, employee, closedAt: null, isDeleted: { $ne: true } }).session(session);
      if (!shift) return { status: 404, message: 'No open shift found' };
      if (record && (record.employee !== employee || String(record.shiftNo) !== String(shiftNo) || record.branch !== shift.branch)) {
        return { status: 409, message: 'Record does not belong to this shift' };
      }
      const updated = { ...shift.cashBalance };
      const logs = [];
      for (const change of changes) {
        const beforeAmount = Number(updated[change.currency]) || 0;
        const afterAmount = Math.round((beforeAmount + (action === 'increase' ? 1 : -1) * change.amount) * 100) / 100;
        updated[change.currency] = afterAmount;
        logs.push({ createdAt: new Date(), docNumber: currentDocNumber, shiftNo, employee, action, currency: change.currency, amount: change.amount, beforeAmount, afterAmount });
      }
      shift.cashBalance = updated;
      await shift.save({ session });
      await AdjustmentLog.insertMany(logs, { session });
      return { status: 200, message: 'Shift cash updated successfully' };
    });
    return NextResponse.json({ message: result.message }, { status: result.status });
  } catch (error) {
    console.error('Error updating shift cash:', error);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

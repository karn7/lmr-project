import { NextResponse } from 'next/server';
import { connectMongoDB } from '../../../../lib/mongodb';
import DailyRecord from '../../../../models/record';
import AdjustmentLog from '../../../../models/adjustmentLog';

export async function GET(req) {
  try {
    await connectMongoDB();

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const employee = searchParams.get("employee");

    if (!date || !employee) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(`${date}T23:59:59.999Z`);

    const dailyRecords = await DailyRecord.find({
      employee: employee,
      createdAt: { $gte: start, $lt: end }
    });

    const adjustmentLogs = await AdjustmentLog.find({
      employee: employee,
      createdAt: { $gte: start, $lt: end }
    });

    const logDocNumbers = new Set(adjustmentLogs.map(log => log.docNumber));
    const result = dailyRecords.map(record => {
      if (!logDocNumbers.has(record.docNumber)) {
        return { ...record.toObject(), missing: true };
      }
      return record;
    });

    return NextResponse.json({ missingLogs: result });
  } catch (err) {
    console.error("Error in check-missing-log:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
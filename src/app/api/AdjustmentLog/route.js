import { NextResponse } from "next/server";
import { connectMongoDB } from "../../../../lib/mongodb";
import AdjustmentLog from "../../../../models/adjustmentLog";

export async function GET(req) {
  try {
    await connectMongoDB();

    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");
    const currencyParam = searchParams.get("currency");

    const query = {};
    if (dateParam) {
      const start = new Date(dateParam);
      const end = new Date(dateParam);
      end.setDate(end.getDate() + 1);
      query.createdAt = { $gte: start, $lt: end };
    }

    if (currencyParam) {
      query.currency = currencyParam;
    }

    // ลบ Log ที่เก่ากว่า 5 วัน
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    await AdjustmentLog.deleteMany({ createdAt: { $lt: fiveDaysAgo } });

    const logs = await AdjustmentLog.find(query).sort({ createdAt: -1 });

    return NextResponse.json({ logs });
  } catch (err) {
    console.error("❌ Error fetching adjustment logs:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


import { NextResponse } from "next/server";
import { connectMongoDB } from "../../../../lib/mongodb";
import Record from "../../../../models/record";

export async function POST(req) {
  try {
    const { branch, date } = await req.json();
    console.log("📨 ค่าที่ได้รับจาก client:", { branch, date });

    await connectMongoDB();
    console.log("✅ Connected to MongoDB");

    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const records = await Record.find({
      branch,
      payType: "Buying",
      createdAt: { $gte: start, $lte: end },
    });

    console.log("📄 จำนวน record ที่เจอ:", records.length);

    let targetRecords = records;

    // ถ้าไม่มี record วันนี้ ให้ไปดูของเมื่อวาน
    if (records.length === 0) {
      const yesterdayStart = new Date(start);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      const yesterdayEnd = new Date(end);
      yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);

      targetRecords = await Record.find({
        branch,
        payType: "Buying",
        createdAt: { $gte: yesterdayStart, $lte: yesterdayEnd },
      });

      console.log("📄 ดึงข้อมูลจากเมื่อวานแทน จำนวน:", targetRecords.length);
    }

    const rateMap = {};

    for (const record of targetRecords) {
      for (const item of record.items) {
        if (!rateMap[item.currency]) {
          rateMap[item.currency] = { total: 0, count: 0 };
        }
        rateMap[item.currency].total += item.rate;
        rateMap[item.currency].count += 1;
      }
    }

    const result = Object.entries(rateMap).map(([currency, { total, count }]) => ({
      currency,
      averageRate: count > 0 ? parseFloat((total / count).toFixed(4)) : 0,
    }));

    console.log("📤 ส่ง averageRate:", result);

    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("❌ Error:", err);
    return NextResponse.json({ message: "Failed to calculate average rate", error: err.message }, { status: 500 });
  }
}
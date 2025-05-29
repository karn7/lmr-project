import { NextResponse } from "next/server";
import { connectMongoDB } from "../../../../lib/mongodb";
import Record from "../../../../models/record";

export async function POST(req) {
  try {
    const { branch, date } = await req.json();
    console.log("📨 ค่าที่ได้รับจาก client:", { branch, date });
    await connectMongoDB();

    const start = new Date(date);
    const end = new Date(date);
    end.setDate(end.getDate() + 1);

    const records = await Record.find({
      branch,
      createdAt: { $gte: start, $lt: end },
    });

    console.log("📄 จำนวน record ที่เจอ:", records.length);
    console.log("📄 ตัวอย่าง record:", records[0]);

    const result = {};

    for (const record of records) {
      const { items = [], payType } = record;

      for (const item of items) {
        const { currency, amount } = item;
        if (!currency) continue;

        if (!result[currency]) {
          result[currency] = 0;
        }

        if (payType === "Buying") {
          result[currency] += parseFloat(amount);
        } else if (payType === "Selling" || payType === "Wholesale") {
          result[currency] -= parseFloat(amount);
        }
      }
    }

    const formatted = Object.entries(result).map(([currency, inOutTotal]) => ({
      currency,
      inOutTotal,
    }));

    console.log("📤 ส่งข้อมูลกลับ:", formatted);
    return NextResponse.json({ data: formatted }, { status: 200 });
  } catch (err) {
    console.error("❌ Error in stock-diff-today:", err);
    return NextResponse.json({ message: "Error", error: err.message }, { status: 500 });
  }
}
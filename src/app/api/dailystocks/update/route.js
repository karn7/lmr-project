

import { NextResponse } from "next/server";
import { connectMongoDB } from "../../../../../lib/mongodb";
import DailyStock from "../../../../../models/dailyStocks";

export async function POST(req) {
  try {
    const { date, branch, items } = await req.json();
    await connectMongoDB();

    const updated = await DailyStock.findOneAndUpdate(
      { date, branch },
      { $set: { items } },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ success: false, message: "ไม่พบข้อมูลสำหรับสาขาและวันที่นี้" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "อัปเดตรายการเรียบร้อยแล้ว", data: updated });
  } catch (error) {
    console.error("❌ update error:", error);
    return NextResponse.json({ success: false, message: "เกิดข้อผิดพลาด", error: error.message }, { status: 500 });
  }
}
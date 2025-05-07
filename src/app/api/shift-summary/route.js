import { NextResponse } from "next/server";
import { connectMongoDB } from "../../../../lib/mongodb";
import { ObjectId } from "mongodb";
import mongoose from "mongoose";

export async function GET(req) {
  try {
    await connectMongoDB();
    const db = mongoose.connection.db;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    console.log("📌 ID param:", id);

    if (!id) {
      return NextResponse.json({ message: "Missing id parameter" }, { status: 400 });
    }

    let query = {};
    try {
      query._id = new ObjectId(id);
      console.log("📌 Using ObjectId:", query._id);
    } catch (err) {
      query._id = id;
      console.log("📌 Using raw string ID:", query._id);
    }

    const shift = await db.collection("shifts").findOne(query);
    console.log("📌 Shift found:", shift);

    if (!shift) {
      return NextResponse.json({ message: "ไม่พบข้อมูลการเปิด-ปิดร้าน" }, { status: 404 });
    }

    const { cashBalance, openAmount, closeAmount, date, shiftNo, branch, employee } = shift;

return NextResponse.json({
  cashBalance,
  openAmount, 
  closeAmount,
  date,
  shiftNo,
  branch,
  employee,
});
  } catch (err) {
    console.error("❌ Error loading shift summary:", err);
    return NextResponse.json({ message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" }, { status: 500 });
  }
}
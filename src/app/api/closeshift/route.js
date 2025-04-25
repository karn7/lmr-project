import { NextResponse } from "next/server";
import Shift from "../../../../models/shift";
import { connectMongoDB } from "../../../../lib/mongodb";

export async function POST(req) {
  try {
    await connectMongoDB();

    const { shiftNo, closeAmount, employee } = await req.json();
    const date = new Date().toISOString().slice(0, 10);
    console.log("💾 รับจาก client:", { date, shiftNo, closeAmount, employee });

    const shift = await Shift.findOne({
      date,
      shiftNo,
      employee: employee?.trim(),
      closedAt: null,
    });
    console.log("🔎 ค้นหา shift:", shift);

    if (!shift) {
      return NextResponse.json({ message: "No open shift found" }, { status: 404 });
    }

    // อัปเดตยอดเงินปิดร้านและเวลาดำเนินการ
    shift.closeAmount = closeAmount;
    shift.closedAt = new Date();
    console.log("📦 ก่อนบันทึก:", shift);
    await shift.save().catch((err) => console.error("❌ save error:", err));
    console.log("✅ บันทึกสำเร็จ:", shift);

    return NextResponse.json({ message: "Shift closed successfully" });
  } catch (error) {
    console.error("Error closing shift:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
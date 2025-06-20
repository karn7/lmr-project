import { NextResponse } from "next/server";
import Shift from "../../../../models/shift";
import { connectMongoDB } from "../../../../lib/mongodb";

export async function POST(req) {
  try {
    await connectMongoDB();

    const { shiftNo, closeAmount, employee } = await req.json();
    const date = new Date().toISOString().slice(0, 10);

    const shift = await Shift.findOne({
      date,
      shiftNo,
      employee: employee?.trim(),
      closedAt: null,
    });

    if (!shift) {
      return NextResponse.json({ message: "No open shift found" }, { status: 404 });
    }

    // อัปเดตยอดเงินปิดร้านและเวลาดำเนินการ
    shift.closeAmount = closeAmount;
    shift.closedAt = new Date();
    await shift.save().catch((err) => console.error("❌ save error:", err));

    return NextResponse.json({ message: "Shift closed successfully" });
  } catch (error) {
    console.error("Error closing shift:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
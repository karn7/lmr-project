import { NextResponse } from "next/server";
import Shift from "../../../../models/shift";
import { connectMongoDB } from "../../../../lib/mongodb";

export async function POST(req) {
  try {
    await connectMongoDB();

    const { date, shiftNo, closeAmount, employee } = await req.json();

    const shift = await Shift.findOne({ date, shiftNo, employee });

    if (!shift) {
      return NextResponse.json({ message: "Shift not found" }, { status: 404 });
    }

    // อัปเดตยอดเงินปิดร้านและเวลาดำเนินการ
    shift.closeAmount = closeAmount;
    shift.closedAt = new Date();
    await shift.save();

    return NextResponse.json({ message: "Shift closed successfully" });
  } catch (error) {
    console.error("Error closing shift:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
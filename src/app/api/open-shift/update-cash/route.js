import { NextResponse } from "next/server";
import Shift from "../../../../../models/shift";
import { connectMongoDB } from "../../../../../lib/mongodb";

export async function POST(req) {
  try {
    await connectMongoDB();

    const { docNumber, totalTHB, totalLAK, currency, amount, action, shiftNo, employee } = await req.json();
    console.log("📥 รับข้อมูล:", { docNumber, totalTHB, totalLAK, currency, amount, action, shiftNo, employee });

    const today = new Date().toISOString().slice(0, 10); // yyyy-mm-dd

    const shift = await Shift.findOne({
      date: today,
      shiftNo,
      employee,
      closedAt: null,
    });

    if (!shift) {
      return NextResponse.json({ message: "No open shift found" }, { status: 404 });
    }

    console.log("💵 ก่อนอัปเดต cashBalance:", shift.cashBalance);

    // อัปเดตยอดเงินใน cashBalance
    const updated = { ...shift.cashBalance };

    if (!["increase", "decrease"].includes(action)) {
      return NextResponse.json({ message: "Invalid action" }, { status: 400 });
    }

    const sign = action === "increase" ? 1 : -1;
    if (totalTHB !== undefined) {
      updated.THB = (parseFloat(updated.THB) || 0) + sign * parseFloat(totalTHB);
    }

    if (totalLAK !== undefined) {
      updated.LAK = (parseFloat(updated.LAK) || 0) + sign * parseFloat(totalLAK);
    }

    if (currency && amount !== undefined) {
      updated[currency] = (parseFloat(updated[currency]) || 0) + sign * parseFloat(amount);
    }

    console.log("✅ cashBalance หลังอัปเดต:", updated);

    // บันทึกกลับ
    shift.cashBalance = updated;
    await shift.save();

    return NextResponse.json({ message: "Shift cash updated successfully" });
  } catch (error) {
    console.error("Error updating shift cash:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

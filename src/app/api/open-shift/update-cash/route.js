import { NextResponse } from "next/server";
import Shift from "../../../../../models/shift";
import AdjustmentLog from "../../../../../models/adjustmentLog";
import { connectMongoDB } from "../../../../../lib/mongodb";
import mongoose from "mongoose";

export async function POST(req) {
  try {
    await connectMongoDB();

    const { docNumber, totalTHB, totalLAK, currency, amount, action, shiftNo, employee } = await req.json();

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

    let beforeAmountOther = 0;
    if (currency && amount !== undefined) {
      beforeAmountOther = parseFloat(shift.cashBalance?.[currency]) || 0;
      updated[currency] = (parseFloat(updated[currency]) || 0) + sign * parseFloat(amount);
    }


    // บันทึกกลับ
    shift.cashBalance = updated;
    const saveResult = await shift.save();

    if (!saveResult || !saveResult._id) {
      await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/Notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          docNumber,
          employee,
          message: `❗เกิดข้อผิดพลาดในการบันทึกยอดเงินสดของ shift: ${docNumber}`,
          type: "systemError",
        }),
      });

      return NextResponse.json({ message: "บันทึกยอดเงินสดไม่สำเร็จ" }, { status: 500 });
    }

    // Log การปรับยอดเงินสดลง MongoDB
    // Log สำหรับ THB
    if (totalTHB !== undefined) {
      const before = parseFloat(shift.cashBalance?.THB) || 0;
      const after = before + sign * parseFloat(totalTHB);
      await AdjustmentLog.create({
        createdAt: new Date(),
        docNumber,
        shiftNo,
        employee,
        action,
        currency: "THB",
        amount: parseFloat(totalTHB),
        beforeAmount: before,
        afterAmount: after
      });
    }

    // Log สำหรับ LAK
    if (totalLAK !== undefined) {
      const before = parseFloat(shift.cashBalance?.LAK) || 0;
      const after = before + sign * parseFloat(totalLAK);
      await AdjustmentLog.create({
        createdAt: new Date(),
        docNumber,
        shiftNo,
        employee,
        action,
        currency: "LAK",
        amount: parseFloat(totalLAK),
        beforeAmount: before,
        afterAmount: after
      });
    }

    // Log สำหรับสกุลอื่น ๆ (ถ้ามี)
    if (currency && amount !== undefined) {
      await AdjustmentLog.create({
        createdAt: new Date(),
        docNumber,
        shiftNo,
        employee,
        action,
        currency,
        amount: parseFloat(amount),
        beforeAmount: beforeAmountOther,
        afterAmount: parseFloat(updated?.[currency]) || 0
      });
    }

    return NextResponse.json({ message: "Shift cash updated successfully" });
  } catch (error) {
    console.error("Error updating shift cash:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

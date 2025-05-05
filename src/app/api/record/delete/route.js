


import { connectMongoDB } from "../../../../../lib/mongodb";
import Record from "../../../../../models/record";
import Shift from "../../../../../models/shift";
import DeleteLog from "../../../../../models/deleteLog";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    await connectMongoDB();
    const { docNumber } = await req.json();

    const record = await Record.findOne({ docNumber });
    if (!record) {
      return NextResponse.json({ message: "ไม่พบรายการ" }, { status: 404 });
    }

    const shift = await Shift.findOne({ shiftNo: record.shiftNo });
    const isShiftClosed = shift?.closedAt ? true : false;
    const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

    if (!isShiftClosed) {
      const updates = [];

      if (record.payType === "Buying") {
        if (record.payMethod === "cash") {
          updates.push({
            currency: "THB",
            amount: record.total,
            action: "decrease",
          });
        }
        if (record.items?.length > 0) {
          for (const item of record.items) {
            updates.push({
              currency: item.currency,
              amount: item.amount,
              action: "increase",
            });
          }
        }
      } else if (record.payType === "Selling") {
        if (record.receiveMethod === "cash") {
          updates.push({
            currency: "THB",
            amount: record.total,
            action: "increase",
          });
        }
        if (record.items?.length > 0) {
          for (const item of record.items) {
            updates.push({
              currency: item.currency,
              amount: item.amount,
              action: "decrease",
            });
          }
        }
      } else if (record.payType === "Wechat") {
        updates.push({
          currency: "THB",
          amount: record.total,
          action: "decrease",
        });
      }

      if (updates.length > 0) {
        await fetch(`${base}/api/open-shift/update-cash`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            updates,
            shiftNo: record.shiftNo,
            docNumber,
            employee: record.employee,
          }),
        });
      }
    }

    await DeleteLog.create({
      docNumber,
      deletedAt: new Date(),
      deletedBy: "admin", // อาจใส่ session.username ในอนาคต
      deletedData: record,
    });

    await Record.deleteOne({ docNumber });

    return NextResponse.json({ message: "ลบเรียบร้อย" }, { status: 200 });
  } catch (err) {
    console.error("❌ Error deleting record:", err);
    return NextResponse.json({ message: "เกิดข้อผิดพลาด", error: err.message }, { status: 500 });
  }
}
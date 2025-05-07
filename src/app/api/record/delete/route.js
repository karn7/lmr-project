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
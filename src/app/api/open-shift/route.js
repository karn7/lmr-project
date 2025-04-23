import { NextResponse } from "next/server";
import { connectMongoDB } from "../../../../lib/mongodb";
import Shift from "../../../../models/shift";

export async function POST(req) {
  try {
    await connectMongoDB();
    const body = await req.json();

    const newShift = await Shift.create({
      ...body,
      cashBalance: body.openAmount, // ตั้งค่าเริ่มต้น cashBalance = openAmount
      createdAt: new Date()
    });

    return NextResponse.json({ message: "เปิดร้านสำเร็จ", shift: newShift }, { status: 201 });
  } catch (err) {
    console.error("Error opening shift:", err);
    return NextResponse.json({ message: "เปิดร้านล้มเหลว" }, { status: 500 });
  }
}

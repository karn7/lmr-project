import { connectMongoDB } from "../../../../../lib/mongodb";
import Shift from "../../../../../models/shift";
import { NextResponse } from "next/server";

export async function GET(req) {
  await connectMongoDB();

  const { searchParams } = new URL(req.url);
  const employee = searchParams.get("employee");
  const shiftNo = searchParams.get("shiftNo");
  const date = searchParams.get("date");

  if (!employee) {
    return NextResponse.json({ open: false, shiftNo: null, cashBalance: null });
  }

  let shift = null;

  if (shiftNo && date) {
    shift = await Shift.findOne({ shiftNo, employee, date });
  } else {
    const today = new Date().toISOString().slice(0, 10);
    shift = await Shift.findOne({ date: today, employee }).sort({ createdAt: -1 });
  }

  const isOpen = shift && !shift.closedAt;

  return NextResponse.json({
    open: isOpen,
    shiftNo: shift?.shiftNo ?? null,
    cashBalance: shift?.cashBalance ?? null,
    openAmount: shift?.openAmount ?? null,
    date: shift?.date ?? null,
    branch: shift?.branch ?? null,
    employee: shift?.employee ?? null,
    closedAt: shift?.closedAt ?? null
  });
}
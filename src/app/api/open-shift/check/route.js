import { connectMongoDB } from "../../../../../lib/mongodb";
import Shift from "../../../../../models/shift";
import { NextResponse } from "next/server";

export async function GET(req) {
  await connectMongoDB();
  const today = new Date().toISOString().slice(0, 10);

  const { searchParams } = new URL(req.url);
  const employee = searchParams.get("employee");

  if (!employee) {
    return NextResponse.json({ open: false, shiftNo: null, cashBalance: null });
  }

  const latest = await Shift.findOne({ date: today, employee }).sort({ createdAt: -1 });

  const isOpen = latest && !latest.closedAt;

  return NextResponse.json({
    open: isOpen,
    shiftNo: isOpen ? latest.shiftNo : null,
    cashBalance: isOpen ? latest.cashBalance : null,
    date: isOpen ? latest.date : null,
    branch: isOpen ? latest.branch : null,
    employee: isOpen ? latest.employee : null
  });
}
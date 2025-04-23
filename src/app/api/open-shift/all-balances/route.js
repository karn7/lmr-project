import { connectMongoDB } from "../../../../../lib/mongodb";
import Shift from "../../../../../models/shift";
import { NextResponse } from "next/server";

export async function GET() {
  await connectMongoDB();
  const today = new Date().toISOString().slice(0, 10);

  try {
    const openShifts = await Shift.find({
      date: today,
      closedAt: null
    });

    const branchBalances = openShifts.map(shift => ({
      branch: shift.branch,
      cashBalance: shift.cashBalance,
      employee: shift.employee,
      date: shift.date,
    }));

    return NextResponse.json({ branchBalances });
  } catch (err) {
    console.error("Failed to fetch open shift balances:", err);
    return NextResponse.json({ branchBalances: [], error: "Internal server error" }, { status: 500 });
  }
}

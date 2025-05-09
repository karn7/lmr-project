export const dynamic = "force-dynamic";

import { connectMongoDB } from "../../../../../lib/mongodb";
import Shift from "../../../../../models/shift";
import { NextResponse } from "next/server";

export async function GET() {
  await connectMongoDB();
  console.log("📦 Connected to DB:", (await import("mongoose")).default.connection.name);
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });

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

    return new NextResponse(JSON.stringify({ branchBalances }), {
      status: 200,
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (err) {
    console.error("Failed to fetch open shift balances:", err);
    return NextResponse.json({ branchBalances: [], error: "Internal server error" }, { status: 500 });
  }
}

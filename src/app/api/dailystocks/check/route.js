

import { NextResponse } from "next/server";
import { connectMongoDB } from "../../../../../lib/mongodb";
import DailyStock from "../../../../../models/dailyStocks";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const branch = searchParams.get("branch");
  const date = searchParams.get("date");

  if (!branch || !date) {
    return NextResponse.json({ exists: false });
  }

  try {
    await connectMongoDB();
    const exists = await DailyStock.exists({ branch, date });
    return NextResponse.json({ exists: !!exists });
  } catch (err) {
    console.error("❌ Error checking DailyStock:", err);
    return NextResponse.json({ exists: false, error: err.message }, { status: 500 });
  }
}
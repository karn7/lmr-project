import { NextResponse } from "next/server";
import { connectMongoDB } from "../../../../../lib/mongodb";
import DailyStock from "../../../../../models/dailyStocks";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const branch = searchParams.get("branch");
    const date = searchParams.get("date");

    if (!branch || !date) {
      return NextResponse.json({ items: [] });
    }

    await connectMongoDB();

    const stock = await DailyStock.findOne({ branch, date });
    return NextResponse.json({ items: stock?.items || [] });
  } catch (err) {
    console.error("❌ Error fetching last-close:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
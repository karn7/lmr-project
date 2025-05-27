

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import DailyStock from "../../../../models/dailyStocks";
import { connectMongoDB } from "../../../../lib/mongodb";

export async function GET() {
  try {
    await connectMongoDB();
    console.log("✅ Connected to MongoDB");

    const dailyStocks = await DailyStock.find().sort({ date: -1, currency: 1 });
    console.log("✅ DailyStocks fetched:", dailyStocks.length);

    return new NextResponse(JSON.stringify({ dailyStocks }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      }
    });
  } catch (err) {
    console.error("❌ Error fetching dailyStocks:", err);
    return NextResponse.json({ message: "Failed to fetch dailyStocks", error: err.message }, { status: 500 });
  }
}
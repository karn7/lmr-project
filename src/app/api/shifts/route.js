import { NextResponse } from "next/server";
import mongoose from "mongoose";
import Shift from "../../../../models/shift";
import { connectMongoDB } from "../../../../lib/mongodb";

export async function GET() {
  try {
    await connectMongoDB();
    console.log("✅ Connected to MongoDB");

    const shifts = await Shift.find().sort({ createdAt: -1 });
    console.log("✅ Shifts fetched:", shifts.length);

    return new NextResponse(JSON.stringify({ shifts }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      }
    });
  } catch (err) {
    console.error("❌ Error fetching shifts:", err);
    return NextResponse.json({ message: "Failed to fetch shifts", error: err.message }, { status: 500 });
  }
}
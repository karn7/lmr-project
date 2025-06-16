export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import Shift from "../../../../models/shift";
import { connectMongoDB } from "../../../../lib/mongodb";

export async function GET() {
  try {
    await connectMongoDB();
    console.log("✅ Connected to MongoDB");

    const rawShifts = await Shift.find().sort({ createdAt: -1 });
    const shifts = rawShifts.map(s => ({
      ...s.toObject(),
      date: new Date(s.date).toISOString().split("T")[0]
    }));

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
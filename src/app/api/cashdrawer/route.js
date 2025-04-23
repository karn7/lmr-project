import { NextResponse } from "next/server";
import { connectMongoDB } from "../../../../lib/mongodb";
import CashDrawer from "../../../../models/cashdrawer";

export async function POST(req) {
  try {
    await connectMongoDB();
    console.log("✅ Connected to MongoDB for cash drawer entry");

    const body = await req.json();
    console.log("💡 Received data:", body);

    const { type, currency, amount, reason, user, date, shiftNo, branch } = body;

    if (
        !type || !currency || amount == null || !user ||
        !date || !branch
      ) {
        return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
      }

    const entry = new CashDrawer({
      type,
      currency,
      amount,
      reason,
      user,
      date,
      shiftNo,
      branch,
      createdAt: new Date()
    });

    console.log("📝 Saving cash drawer entry:", entry);
    await entry.save();

    return NextResponse.json({ message: "Cash drawer entry recorded", id: entry._id });
  } catch (error) {
    console.error("❌ Error saving cash drawer entry:", error);
    return NextResponse.json({ message: "Server error", error: error.message }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    await connectMongoDB();
    const { searchParams } = new URL(req.url);

    const listType = searchParams.get("list");
    if (listType === "employees") {
      const employees = await CashDrawer.distinct("user");
      return NextResponse.json({ employees });
    }

    const user = searchParams.get("user");
    const date = searchParams.get("date");
    const shiftNo = parseInt(searchParams.get("shiftNo"));

    if (!user || !date || isNaN(shiftNo)) {
      return NextResponse.json({ message: "Missing or invalid parameters" }, { status: 400 });
    }

    const entries = await CashDrawer.find({
      user,
      date,
      shiftNo,
    }).sort({ createdAt: -1 });

    return NextResponse.json({ entries });
  } catch (error) {
    console.error("❌ Error fetching cash drawer entries:", error);
    return NextResponse.json({ message: "Server error", error: error.message }, { status: 500 });
  }
}



export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { connectMongoDB } from "../../../../../lib/mongodb";
import DailyStock from "../../../../../models/dailyStocks";

/**
 * This endpoint deliberately supports **POST** (not DELETE) because
 * it is called from the client with `fetch(..., { method: "POST" })`
 */
export async function POST(req) {
  try {
    const { date, branch } = await req.json();

    if (!date || !branch) {
      return NextResponse.json(
        { success: false, message: "date and branch are required" },
        { status: 400 }
      );
    }

    // connect to DB
    await connectMongoDB();

    // delete matching documents
    const result = await DailyStock.deleteMany({ date, branch });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, message: "No matching stock found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, deleted: result.deletedCount },
      { status: 200 }
    );
  } catch (err) {
    console.error("❌ Error deleting DailyStock:", err);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}

/**
 * Optional: block GET/PUT/DELETE etc. to keep API clear
 */
export function GET() {
  return NextResponse.json(
    { message: "Use POST to delete daily stocks" },
    { status: 405 }
  );
}
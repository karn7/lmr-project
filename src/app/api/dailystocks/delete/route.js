


export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { connectMongoDB } from "../../../../../lib/mongodb";
import DailyStock from "../../../../../models/dailyStocks";
import { getToken } from "next-auth/jwt";

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/**
 * This endpoint deliberately supports **POST** (not DELETE) because
 * it is called from the client with `fetch(..., { method: "POST" })`
 */
export async function POST(req) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (token?.role !== "admin") {
      return NextResponse.json({ success: false, message: "เฉพาะผู้ดูแลระบบเท่านั้น" }, { status: 403 });
    }
    const { date, startDate, endDate, branch } = await req.json();
    // Keep single-date callers compatible; a supplied range must be complete.
    const hasRange = startDate !== undefined || endDate !== undefined;
    const from = hasRange ? startDate : date;
    const to = hasRange ? endDate : date;

    if (typeof branch !== "string" || !branch.trim() || branch === "ALL" ||
        !isValidDate(from) || !isValidDate(to) || from > to) {
      return NextResponse.json(
        { success: false, message: "กรุณาระบุสาขาและช่วงวันที่ที่ถูกต้อง (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    // connect to DB
    await connectMongoDB();

    // delete matching documents
    const result = await DailyStock.deleteMany({ branch, date: { $gte: from, $lte: to } });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, message: "ไม่พบสต๊อกของสาขานี้ในช่วงวันที่ที่เลือก" },
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

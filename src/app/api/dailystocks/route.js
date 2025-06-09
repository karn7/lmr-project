export const runtime = "nodejs";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import DailyStock from "../../../../models/dailyStocks";
import { connectMongoDB } from "../../../../lib/mongodb";
import Record from "../../../../models/record";
import PDFDocument from "pdfkit";
import { PassThrough } from "stream";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const branch = searchParams.get("branch");
  const date = searchParams.get("date");

  if (branch && date) {
    try {
      await connectMongoDB();
      const stocks = await DailyStock.find({ branch, date });

      if (!stocks || stocks.length === 0) {
        return NextResponse.json({ message: "No data found" }, { status: 404 });
      }

      return NextResponse.json({ message: "PDF generation removed, data available", stocks }, { status: 200 });
    } catch (err) {
      console.error("❌ Error generating PDF:", err);
      return NextResponse.json({ message: "Failed to fetch stocks", error: err.message }, { status: 500 });
    }
  }

  try {
    await connectMongoDB();
  //  console.log("✅ Connected to MongoDB");

    const dailyStocks = await DailyStock.find().sort({ date: -1 });
   // console.log("✅ DailyStocks fetched:", dailyStocks.length);

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

export async function POST(req) {
  try {
    await connectMongoDB();
    const {
      date,
      branch,
      items, // array ของ { currency, carryOver, inOutTotal, averageRate, actual, difference, finalized }
      createdBy
    } = await req.json();

   // console.log("📥 รับข้อมูลจาก client:", { date, branch, items, createdBy });

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ message: "Invalid items format" }, { status: 400 });
    }

    const created = await DailyStock.create({
      date,
      branch,
      items,
      createdBy
    });

    return NextResponse.json({ message: "DailyStock created", created }, { status: 201 });
  } catch (err) {
    console.error("❌ Error creating DailyStock:", err);
    return NextResponse.json({ message: "Error", error: err.message }, { status: 500 });
  }
}
// File: src/app/api/record/route.js
import { NextResponse } from "next/server";
import { connectMongoDB } from "../../../../lib/mongodb";
import Record from "../../../../models/record";
import generateDocNumber from "../../../../lib/generateDocNumber";

export async function POST(req) {
  try {
    await connectMongoDB();

    const {
      items,
      employee,
      branch,
      customerName,
      payType,
      payMethod,
      payMethodNote,
      receiveMethod,
      receiveMethodNote,
      total,
      note
    } = await req.json();
    
    console.log("📥 Incoming record data:", {
      items,
      employee,
      branch,
      customerName,
      payType,
      payMethod,
      payMethodNote,
      receiveMethod,
      receiveMethodNote,
      total,
      note
    });

    const prefix = payType === "Selling" ? "S" : payType === "Buying" ? "B" : "A";
    const docNumber = await generateDocNumber(prefix);

    const newRecord = new Record({
      docNumber,
      items,
      employee,
      branch,
      customerName,
      payType,
      payMethod,
      payMethodNote,
      receiveMethod,
      receiveMethodNote,
      total,
      note,
      createdAt: new Date()
    });

    await newRecord.save();

    return NextResponse.json({ message: "Record saved successfully", docNumber }, { status: 201 });

  } catch (error) {
    console.error("❌ Error saving record:", error);
    return NextResponse.json({ message: "Failed to save record", error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    await connectMongoDB();
    const records = await Record.find().sort({ createdAt: -1 }); // Sort latest first
    return NextResponse.json({ records }, { status: 200 });
  } catch (error) {
    console.error("Error fetching records:", error);
    return NextResponse.json({ message: "Failed to fetch records" }, { status: 500 });
  }
}

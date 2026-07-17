// File: src/app/api/record/route.js
import { NextResponse } from "next/server";
import { connectMongoDB } from "../../../../lib/mongodb";
import Record from "../../../../models/record";
import generateDocNumber from "../../../../lib/generateDocNumber";

export async function POST(req) {
  try {
    await connectMongoDB();

    const {
      employeeCode,
      ...recordData
    } = await req.json();
    
    const prefix = recordData.payType === "Selling" ? "S" : recordData.payType === "Buying" ? "B" : "A";
    const docNumber = await generateDocNumber(prefix, recordData.employee, employeeCode);

    const newRecord = new Record({
      ...recordData,
      docNumber,
      createdAt: new Date()
    });

    await newRecord.save();

    return NextResponse.json({ message: "Record saved successfully", docNumber }, { status: 201 });

  } catch (error) {
    console.error("❌ Error saving record:", error);
    return NextResponse.json({ message: "Failed to save record", error: error.message }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    await connectMongoDB();

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const pipeline = [];

    if (date) {
      const startDate = new Date(`${date}T00:00:00.000Z`);
      const endDate = new Date(startDate);
      endDate.setUTCDate(endDate.getUTCDate() + 1);

      pipeline.push({
        $match: {
          $or: [
            { date },
            { createdAt: { $gte: startDate, $lt: endDate } },
          ],
        },
      });
    }

    const records = await Record.aggregate([
      ...pipeline,
      { $sort: { createdAt: -1 } },
      { $project: { "customerSignature.image": 0 } },
    ]).allowDiskUse(true); // Sort latest first
    return NextResponse.json({ records }, { status: 200 });
  } catch (error) {
    console.error("Error fetching records:", error);
    return NextResponse.json(
      { message: "Failed to fetch records", error: error.message },
      { status: 500 }
    );
  }
}

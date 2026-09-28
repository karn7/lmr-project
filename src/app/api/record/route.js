// File: src/app/api/record/route.js
import { NextResponse } from "next/server";
import { connectMongoDB } from "../../../../lib/mongodb";
import Record from "../../../../models/record";
import generateDocNumber from "../../../../lib/generateDocNumber";
import { withRecordNumbering } from "../../../../lib/record-numbering";

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    await connectMongoDB();

    const {
      employeeCode,
      ...recordData
    } = await req.json();
    
    const prefix = recordData.payType === "Selling" ? "S" : recordData.payType === "Buying" ? "B" : "A";
    const saved = await withRecordNumbering(async (session) => {
      const number = await generateDocNumber(prefix, recordData.employee, employeeCode, session);
      const newRecord = new Record({
        ...recordData,
        employeeCode,
        docNumber: number,
        createdAt: new Date(),
        recordedAt: new Date(),
        recordedBy: recordData.employee,
        batchId: undefined,
        docNumberHistory: [],
      });
      await newRecord.save({ session });
      return { docNumber: number, recordId: String(newRecord._id) };
    });

    return NextResponse.json({ message: "Record saved successfully", ...saved }, { status: 201 });

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
      const startDate = new Date(`${date}T00:00:00.000+07:00`);
      const endDate = new Date(startDate);
      endDate.setUTCDate(endDate.getUTCDate() + 1);

      pipeline.push({
        $match: {
          $or: [
            { date },
            { date: { $in: [null, ""] }, createdAt: { $gte: startDate, $lt: endDate } },
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

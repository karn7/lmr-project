import { connectMongoDB } from "../../../../../lib/mongodb";
import Record from "../../../../../models/record";
import { NextResponse } from "next/server";

export async function GET(req, { params }) {
  try {
    await connectMongoDB();

    const record = await Record.findOne({ docNumber: params.docNumber }); // 👈 ใช้ docNumber แทน _id
    if (!record) {
      return NextResponse.json({ message: "Record not found" }, { status: 404 });
    }

    return NextResponse.json({ record }, { status: 200 });
  } catch (error) {
    console.error("Error fetching record:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
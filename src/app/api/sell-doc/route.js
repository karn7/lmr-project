import { NextResponse } from "next/server";
import { connectMongoDB } from "../../../../lib/mongodb";
import generateDocNumber from "../../../../lib/generateDocNumber";

export async function POST() {
  try {
    await connectMongoDB();
    const recordId = await generateDocNumber("S");
    return NextResponse.json({ recordId }, { status: 201 });
  } catch (error) {
    console.error("Error generating doc number:", error);
    return NextResponse.json({ message: "Failed to generate doc number" }, { status: 500 });
  }
}
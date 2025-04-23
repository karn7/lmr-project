import { NextResponse } from "next/server";
import { connectMongoDB } from "../../../../../lib/mongodb";
import Shift from "../../../../../models/shift";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const branch = searchParams.get("branch");

  await connectMongoDB();
  const count = await Shift.countDocuments({ date, branch });
  return NextResponse.json({ count });
}
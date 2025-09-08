
import { NextResponse } from "next/server";
import { connectMongoDB } from "../../../../lib/mongodb";
import User from "../../../../models/user";

export async function GET() {
  await connectMongoDB();
  const branches = await User.distinct("branch", { branch: { $ne: null } });
  const employees = await User.distinct("name", { name: { $ne: null } });
  return NextResponse.json({ branches, employees });
}
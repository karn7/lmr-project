import { NextResponse } from "next/server";
import { connectMongoDB } from "../../../../../lib/mongodb";
import User from "../../../../../models/user";
import { getToken } from "next-auth/jwt";

export async function GET(request) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await connectMongoDB();

    const { searchParams } = new URL(request.url);
    const employeeCode = searchParams.get("employeeCode")?.trim();
    const name = searchParams.get("name")?.trim();

    if (!employeeCode && !name) {
      return new NextResponse("Employee is required", { status: 400 });
    }

    const user = await User.findOne(
      employeeCode ? { employeeCode } : { name }
    ).select("employeeSignature");

    if (!user?.employeeSignature?.image) {
      return new NextResponse("Signature not found", { status: 404 });
    }

    return new NextResponse(user.employeeSignature.image, {
      status: 200,
      headers: {
        "Content-Type": user.employeeSignature.contentType || "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Employee signature image error:", error);
    return NextResponse.json(
      { message: "เกิดข้อผิดพลาดในการโหลดลายเซ็นพนักงาน" },
      { status: 500 }
    );
  }
}

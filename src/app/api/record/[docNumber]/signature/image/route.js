import { connectMongoDB } from "../../../../../../../lib/mongodb";
import Record from "../../../../../../../models/record";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function GET(request, { params }) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await connectMongoDB();

    const record = await Record.findOne({ docNumber: params.docNumber }).select(
      "customerSignature"
    );

    if (!record?.customerSignature?.image) {
      return new NextResponse("Signature not found", { status: 404 });
    }

    return new NextResponse(record.customerSignature.image, {
      status: 200,
      headers: {
        "Content-Type": record.customerSignature.contentType || "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Signature image error:", error);
    return NextResponse.json(
      { message: "เกิดข้อผิดพลาดในการโหลดลายเซ็น" },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token || token.role !== "admin") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await connectMongoDB();

    const record = await Record.findOne({ docNumber: params.docNumber });
    if (!record) {
      return NextResponse.json({ message: "ไม่พบรายการ" }, { status: 404 });
    }

    record.customerSignature = undefined;
    record.signatureConfirmed = false;
    await record.save();

    return NextResponse.json({ success: true, message: "ลบลายเซ็นลูกค้าเรียบร้อย" });
  } catch (error) {
    console.error("Delete signature error:", error);
    return NextResponse.json(
      { message: "เกิดข้อผิดพลาดในการลบลายเซ็น" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { connectMongoDB } from "../../../../../lib/mongodb";
import Record from "../../../../../models/record";

export async function POST(req) {
  try {
    const { _id, docNumber, createdAt, payType, items, total } = await req.json();

    await connectMongoDB();

    const cleanedItems = items;

    console.log("📥 ข้อมูลหลัง parse:");
    console.log("🧪 _id:", _id);
    console.log("🧪 docNumber:", docNumber);
    console.log("🧪 createdAt:", createdAt);
    console.log("🧪 payType:", payType);
    console.log("🧪 total:", total);
    console.log("🧪 items:", cleanedItems);

    const updatedCreatedAt = new Date(createdAt); // client ส่งค่า ISO ที่รวมวันและเวลาใหม่มาแล้ว

    const updated = await Record.findByIdAndUpdate(
      _id,
      {
        $set: {
          "docNumber": docNumber,
          "createdAt": updatedCreatedAt,
          "payType": payType,
          "items": items,
          "total": total
        }
      },
      { new: true }
    );
    console.log("✅ MongoDB updated.createdAt:", updated?.createdAt);

    if (!updated) {
      return NextResponse.json({ success: false, message: "ไม่พบรายการที่ต้องการแก้ไข" }, { status: 404 });
    }

    console.log("✅ MongoDB updated.createdAt:", updated?.createdAt);
    return NextResponse.json({ success: true, message: "อัปเดตเรียบร้อยแล้ว", record: updated });
  } catch (error) {
    console.error("Update error:", error);
    return NextResponse.json({ success: false, message: "เกิดข้อผิดพลาด", error: error.message }, { status: 500 });
  }
}
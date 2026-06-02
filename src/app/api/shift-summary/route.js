import { NextResponse } from "next/server";
import { connectMongoDB } from "../../../../lib/mongodb";
import { ObjectId } from "mongodb";
import mongoose from "mongoose";

export async function GET(req) {
  try {
    await connectMongoDB();
    const db = mongoose.connection.db;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ message: "Missing id parameter" }, { status: 400 });
    }

    const query = buildIdQuery(id);

    const shift = await db.collection("shifts").findOne(query);

    if (!shift) {
      return NextResponse.json({ message: "ไม่พบข้อมูลการเปิด-ปิดร้าน หรือข้อมูลถูกลบแล้ว" }, { status: 404 });
    }

    const { cashBalance, openAmount, closeAmount, date, shiftNo, branch, employee } = shift;

return NextResponse.json({
  cashBalance,
  openAmount, 
  closeAmount,
  date,
  shiftNo,
  branch,
  employee,
});
  } catch (err) {
    console.error("❌ Error loading shift summary:", err);
    return NextResponse.json({ message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" }, { status: 500 });
  }
}

function buildIdQuery(id) {
  let query = {};
  try {
    query._id = new ObjectId(id);
  } catch (err) {
    query._id = id;
  }
  query.isDeleted = { $ne: true };
  return query;
}

export async function PUT(req) {
  try {
    await connectMongoDB();
    const db = mongoose.connection.db;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ message: "Missing id parameter" }, { status: 400 });
    }

    const { closeAmount, reason, employee } = await req.json();

    if (!closeAmount || typeof closeAmount !== "object") {
      return NextResponse.json({ message: "Missing closeAmount" }, { status: 400 });
    }

    if (!reason || !reason.trim()) {
      return NextResponse.json({ message: "Missing edit reason" }, { status: 400 });
    }

    const query = buildIdQuery(id);
    const existingShift = await db.collection("shifts").findOne(query);

    if (!existingShift) {
      return NextResponse.json({ message: "ไม่พบข้อมูลการเปิด-ปิดร้าน หรือข้อมูลถูกลบแล้ว" }, { status: 404 });
    }

    const now = new Date();
    const editLog = {
      editedAt: now,
      editedBy: employee || "",
      reason: reason.trim(),
      beforeCloseAmount: existingShift.closeAmount || {},
      afterCloseAmount: closeAmount,
    };

    const result = await db.collection("shifts").updateOne(query, {
      $set: {
        closeAmount,
        updatedAt: now,
        lastEditReason: reason.trim(),
      },
      $push: {
        editLogs: editLog,
      },
    });

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "ไม่พบข้อมูลการเปิด-ปิดร้าน หรือข้อมูลถูกลบแล้ว" }, { status: 404 });
    }

    return NextResponse.json({
      message: "แก้ไขข้อมูลสำเร็จ",
      closeAmount,
      editLog,
    });
  } catch (err) {
    console.error("❌ Error updating shift summary:", err);
    return NextResponse.json({ message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    await connectMongoDB();
    const db = mongoose.connection.db;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ message: "Missing id parameter" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const reason = body.reason;

    if (!reason || !reason.trim()) {
      return NextResponse.json({ message: "Missing delete reason" }, { status: 400 });
    }

    const query = buildIdQuery(id);
    const existingShift = await db.collection("shifts").findOne(query);

    if (!existingShift) {
      return NextResponse.json({ message: "ไม่พบข้อมูลการเปิด-ปิดร้าน หรือข้อมูลถูกลบแล้ว" }, { status: 404 });
    }

    const now = new Date();
    const result = await db.collection("shifts").updateOne(query, {
      $set: {
        deletedAt: now,
        deletedBy: body.employee || "",
        deleteReason: reason.trim(),
        isDeleted: true,
      },
      $push: {
        deleteLogs: {
          deletedAt: now,
          deletedBy: body.employee || "",
          reason: reason.trim(),
          snapshot: existingShift,
        },
      },
    });

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "ไม่พบข้อมูลการเปิด-ปิดร้าน หรือข้อมูลถูกลบแล้ว" }, { status: 404 });
    }

    return NextResponse.json({
      message: "ลบข้อมูลสำเร็จ",
      deletedAt: now,
    });
  } catch (err) {
    console.error("❌ Error deleting shift summary:", err);
    return NextResponse.json({ message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" }, { status: 500 });
  }
}

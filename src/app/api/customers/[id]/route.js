import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { connectMongoDB } from "../../../../../lib/mongodb";
import Customer from "../../../../../models/Customer";
import Record from "../../../../../models/record";

export async function GET(req, { params }) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (token.role !== "admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    await connectMongoDB();
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "รหัสลูกค้าไม่ถูกต้อง" }, { status: 400 });
    }

    const customer = await Customer.findById(id).lean();
    if (!customer) {
      return NextResponse.json({ message: "ไม่พบข้อมูลลูกค้า" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(Number.parseInt(searchParams.get("page") || "1", 10), 1);
    const limit = Math.min(Math.max(Number.parseInt(searchParams.get("limit") || "20", 10), 1), 100);
    const skip = (page - 1) * limit;
    const recordFilter = { customerId: customer.idNumber };

    const [records, totalRecords, summary] = await Promise.all([
      Record.find(recordFilter)
        .select("-customerSignature.image")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Record.countDocuments(recordFilter),
      Record.aggregate([
        { $match: recordFilter },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: { $ifNull: ["$total", 0] } },
            firstTransactionAt: { $min: "$createdAt" },
            lastTransactionAt: { $max: "$createdAt" },
            buyingCount: { $sum: { $cond: [{ $eq: ["$payType", "Buying"] }, 1, 0] } },
            sellingCount: { $sum: { $cond: [{ $eq: ["$payType", "Selling"] }, 1, 0] } },
          },
        },
      ]),
    ]);

    const { _id, __v, ...customerData } = customer;
    return NextResponse.json({
      customer: { id: String(_id), ...customerData },
      summary: {
        transactionCount: totalRecords,
        totalAmount: summary[0]?.totalAmount || 0,
        buyingCount: summary[0]?.buyingCount || 0,
        sellingCount: summary[0]?.sellingCount || 0,
        firstTransactionAt: summary[0]?.firstTransactionAt || null,
        lastTransactionAt: summary[0]?.lastTransactionAt || null,
      },
      records,
      pagination: { page, limit, total: totalRecords, pages: Math.ceil(totalRecords / limit) },
    });
  } catch (error) {
    console.error("[GET /api/customers/:id] Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (token.role !== "admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "รหัสลูกค้าไม่ถูกต้อง" }, { status: 400 });
    }

    await connectMongoDB();
    const customer = await Customer.findById(id).lean();
    if (!customer) {
      return NextResponse.json({ message: "ไม่พบข้อมูลลูกค้า" }, { status: 404 });
    }

    // ลบเฉพาะ Customer profile โดยคงธุรกรรมย้อนหลังไว้เป็นหลักฐาน
    const linkedRecordCount = await Record.countDocuments({ customerId: customer.idNumber });
    await Customer.deleteOne({ _id: id });

    return NextResponse.json({
      message: "ลบข้อมูลลูกค้าเรียบร้อยแล้ว",
      linkedRecordCount,
    });
  } catch (error) {
    console.error("[DELETE /api/customers/:id] Error:", error);
    return NextResponse.json({ message: "ลบข้อมูลลูกค้าไม่สำเร็จ" }, { status: 500 });
  }
}


export async function PATCH(req, { params }) {
  let session;
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (token.role !== "admin") return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "รหัสลูกค้าไม่ถูกต้อง" }, { status: 400 });
    }
    let body;
    try { body = await req.json(); } catch {
      return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
    }
    const updates = {};
    for (const field of ["fullName", "nationality", "idType", "idNumber", "branch", "notes", "customerStatus", "riskStatus"]) {
      if (!(field in body)) continue;
      if (typeof body[field] !== "string") return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
      updates[field] = body[field].trim();
    }
    if ("isActive" in body) {
      if (typeof body.isActive !== "boolean") return NextResponse.json({ message: "สถานะไม่ถูกต้อง" }, { status: 400 });
      updates.isActive = body.isActive;
    }
    if ("contactInfo" in body) {
      if (body.contactInfo !== null && typeof body.contactInfo !== "string" && (typeof body.contactInfo !== "object" || Array.isArray(body.contactInfo))) {
        return NextResponse.json({ message: "ข้อมูลติดต่อไม่ถูกต้อง" }, { status: 400 });
      }
      updates.contactInfo = body.contactInfo;
    }
    for (const field of ["documentExpiresAt", "dataCollectedAt"]) {
      if (!(field in body)) continue;
      const value = body[field];
      if (value !== null && (typeof value !== "string" || !Number.isFinite(Date.parse(value)))) {
        return NextResponse.json({ message: "วันที่ไม่ถูกต้อง" }, { status: 400 });
      }
      updates[field] = value === null ? null : new Date(value);
    }
    if (updates.fullName) updates.fullName = updates.fullName.replace(/\s+/g, " ");
    if (updates.nationality) updates.nationality = updates.nationality.toUpperCase();
    if (updates.idNumber) updates.idNumber = updates.idNumber.replace(/[\s-]+/g, "").toUpperCase();
    await connectMongoDB();
    session = await mongoose.startSession();
    const customer = await session.withTransaction(async () => {
      const customer = await Customer.findById(id).session(session);
      if (!customer) throw Object.assign(new Error("ไม่พบข้อมูลลูกค้า"), { status: 404 });
      const oldNumber = customer.idNumber;
      const oldType = customer.idType;
      Object.assign(customer, updates);
      await customer.validate();
      if (customer.idNumber !== oldNumber || customer.idType !== oldType) {
        // Record links use only the document number, so ambiguous links cannot be migrated safely.
        const conflict = await Customer.exists({ _id: { $ne: customer._id }, $or: [{ idNumber: customer.idNumber }, { idNumber: oldNumber }] }).session(session);
        if (conflict) throw Object.assign(new Error("เลขเอกสารซ้ำหรือเชื่อมโยงกับลูกค้าหลายคน กรุณาตรวจสอบข้อมูล"), { status: 409 });
      }
      await customer.save({ session });
      if (customer.idNumber !== oldNumber) {
        await Record.updateMany({ customerId: oldNumber }, { $set: { customerId: customer.idNumber } }, { session });
      }
      return customer.toJSON();
    });
    return NextResponse.json({ customer, message: "บันทึกข้อมูลลูกค้าเรียบร้อยแล้ว" });
  } catch (error) {
    if (error.code === 11000) return NextResponse.json({ message: "มีลูกค้าใช้เลขเอกสารนี้แล้ว" }, { status: 409 });
    if (error.name === "ValidationError") return NextResponse.json({ message: "กรุณาตรวจสอบข้อมูลบังคับ สัญชาติ และเลขเอกสาร" }, { status: 400 });
    if (error.status) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error("[PATCH /api/customers/:id] Error:", error);
    return NextResponse.json({ message: "บันทึกข้อมูลลูกค้าไม่สำเร็จ" }, { status: 500 });
  } finally {
    if (session) await session.endSession();
  }
}

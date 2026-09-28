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

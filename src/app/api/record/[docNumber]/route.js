import { connectMongoDB } from "../../../../../lib/mongodb";
import Record from "../../../../../models/record";
import Customer from "../../../../../models/Customer";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function GET(req, { params }) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    if (token.role !== "admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    await connectMongoDB();

    const record = await Record.findOne({ docNumber: params.docNumber }).lean(); // 👈 ใช้ docNumber แทน _id
    if (!record) {
      return NextResponse.json({ message: "Record not found" }, { status: 404 });
    }

    const customer = record.customerId
      ? await Customer.findOne({ idNumber: record.customerId }).lean()
      : null;

    return NextResponse.json(
      {
        record: {
          ...record,
          customer: customer
            ? {
                fullName: customer.fullName,
                nationality: customer.nationality,
                idType: customer.idType,
                idNumber: customer.idNumber,
              }
            : null,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching record:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

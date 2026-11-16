import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { connectMongoDB } from "../../../../../lib/mongodb";
import Customer from "../../../../../models/Customer";
import Record from "../../../../../models/record";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ message: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    if (token.role !== "admin") return NextResponse.json({ message: "เฉพาะผู้ดูแลระบบ" }, { status: 403 });
    const params = new URL(req.url).searchParams;
    const nationality = params.get("nationality") || "";
    const date = params.get("date") || "";
    if (nationality && !/^[A-Z]{2}$/.test(nationality)) {
      return NextResponse.json({ message: "สัญชาติไม่ถูกต้อง" }, { status: 400 });
    }
    const start = date ? new Date(`${date}T00:00:00.000+07:00`) : null;
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(start.getTime()) || new Date(start.getTime() + 7 * 3600000).toISOString().slice(0, 10) !== date)) {
      return NextResponse.json({ message: "วันที่ไม่ถูกต้อง" }, { status: 400 });
    }
    await connectMongoDB();
    if (params.get("options") === "1") {
      const values = await Customer.distinct("nationality");
      return NextResponse.json({ nationalities: values.filter((value) => /^[A-Z]{2}$/.test(value)).sort() });
    }
    const filter = nationality ? { nationality } : {};
    if (date) {
      const end = new Date(start.getTime() + 24 * 3600000);
      const ids = await Record.distinct("customerId", {
        $or: [{ date }, { date: { $in: [null, ""] }, createdAt: { $gte: start, $lt: end } }],
      });
      filter.idNumber = { $in: ids.filter((id) => typeof id === "string" && id) };
    }
    // Sample customers, so frequent transactions do not increase a person's odds.
    const [result] = await Customer.aggregate([
      { $match: filter },
      { $facet: { items: [{ $sample: { size: 1 } }, { $project: { fullName: 1, idType: 1, idNumber: 1, nationality: 1 } }], count: [{ $count: "total" }] } },
    ]);
    const customer = result?.items[0];
    return NextResponse.json({
      total: result?.count[0]?.total || 0,
      customer: customer ? { ...customer, _id: undefined, id: String(customer._id) } : null,
    });
  } catch (error) {
    console.error("[GET /api/customers/random] Error:", error);
    return NextResponse.json({ message: "สุ่มลูกค้าไม่สำเร็จ กรุณาลองอีกครั้ง" }, { status: 500 });
  }
}

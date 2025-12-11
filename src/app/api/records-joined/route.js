import { connectMongoDB } from "../../../../lib/mongodb";
import Record from "../../../../models/record";
import Customer from "../../../../models/Customer";

export async function POST(req) {
  try {
    await connectMongoDB();

    const { startDate, endDate, payType, branch } = await req.json();

    // สร้าง query ตามช่วงวันที่ + payType (ถ้ามี) + branch (ถ้ามี)
    const query = {
      date: { $gte: startDate, $lte: endDate },
    };

    if (payType) {
      query.payType = payType; // เช่น "P" หรือ "NP" หรือ "Buying/Selling" ตามที่ใช้จริง
    }

    // ถ้ามีการเลือกสาขา (ไม่ใช่ค่าว่าง) ให้ filter ตาม branch
    if (branch) {
      query.branch = branch;
    }

    const records = await Record.find(query).lean();

    // join customer ทีละรายการ
    const result = await Promise.all(
      records.map(async (rec) => {
        const customer = rec.customerId
          ? await Customer.findOne({ idNumber: rec.customerId }).lean()
          : null;

        return {
          docNumber: rec.docNumber,
          customerId: rec.customerId,
          customerName: rec.customerName,
          items: rec.items,
          createdAt: rec.createdAt,

          // ข้อมูลจาก customer
          nationality: customer?.nationality || "",
          idType: customer?.idType || "",

          // รหัสประเภทเอกสารสำหรับธนาคารแห่งประเทศไทย
          idTypeCode:
            customer?.idType === "thai_id"
              ? "324001 : เลขประจำตัวประชาชน"
              : customer?.idType === "passport"
              ? "324002 : เลขที่หนังสือเดินทาง"
              : "",

          idNumber: customer?.idNumber || "",
        };
      })
    );

    return Response.json({ success: true, data: result });

  } catch (err) {
    console.error("JOIN ERROR:", err);
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
import { NextResponse } from "next/server";
import { connectMongoDB } from "../../../../../lib/mongodb";
import Record from "../../../../../models/record";
import Customer from "../../../../../models/Customer";
import { getToken } from "next-auth/jwt";

export async function POST(req) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    if (token.role !== "admin") {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const {
      _id,
      docNumber,
      expectedDocNumber,
      createdAt,
      payType,
      items,
      total,
      payMethod,
      receiveMethod,
      customerName,
      customerId,
      originalCustomerId,
      nationality,
      selectedCustomerId,
    } = await req.json();

    await connectMongoDB();

    const storedRecord = await Record.findById(_id).lean();
    if (!storedRecord) {
      return NextResponse.json({ success: false, message: "ไม่พบรายการที่ต้องการแก้ไข" }, { status: 404 });
    }
    if (expectedDocNumber && expectedDocNumber !== storedRecord.docNumber) {
      return NextResponse.json({ success: false, message: "เลขบิลเปลี่ยนแล้ว กรุณาโหลดรายการใหม่ก่อนแก้ไข" }, { status: 409 });
    }

    const normalizedCustomerId = String(customerId || "").replace(/[\s-]+/g, "").toUpperCase();
    const normalizedOriginalCustomerId = String(storedRecord.customerId || originalCustomerId || "")
      .replace(/[\s-]+/g, "")
      .toUpperCase();
    const normalizedNationality = String(nationality || "").trim().toUpperCase();

    const originalCustomer = normalizedOriginalCustomerId
      ? await Customer.findOne({ idNumber: normalizedOriginalCustomerId })
      : null;
    let customer;
    if (selectedCustomerId) {
      customer = await Customer.findById(selectedCustomerId);
      if (!customer) {
        return NextResponse.json({ success: false, message: "ไม่พบลูกค้าที่เลือก" }, { status: 404 });
      }
    } else {
      if (!originalCustomer) {
        return NextResponse.json({ success: false, message: "ไม่พบข้อมูลลูกค้าที่เชื่อมกับรายการ" }, { status: 404 });
      }
      if (normalizedCustomerId.length < 4) {
        return NextResponse.json({ success: false, message: "เลขบัตร/พาสปอร์ตไม่ถูกต้อง" }, { status: 400 });
      }
      if (!/^[A-Z]{2}$/.test(normalizedNationality)) {
        return NextResponse.json({ success: false, message: "สัญชาติต้องเป็นรหัสประเทศ 2 ตัวอักษร" }, { status: 400 });
      }

      customer = originalCustomer;
      const existingCustomer = await Customer.findOne({
        _id: { $ne: originalCustomer._id },
        idType: originalCustomer.idType,
        idNumber: normalizedCustomerId,
      });
      if (existingCustomer) customer = existingCustomer;
    }

    const isChangingLinkedCustomer =
      !originalCustomer || String(customer._id) !== String(originalCustomer._id);
    const finalCustomerId = isChangingLinkedCustomer ? customer.idNumber : normalizedCustomerId;
    const finalCustomerName = isChangingLinkedCustomer ? customer.fullName : customerName;

    const updatedCreatedAt = new Date(createdAt); // client ส่งค่า ISO ที่รวมวันและเวลาใหม่มาแล้ว

    const updated = await Record.findOneAndUpdate(
      { _id, docNumber: storedRecord.docNumber },
      {
        $set: {
          "docNumber": docNumber,
          "createdAt": updatedCreatedAt,
          "payType": payType,
          "payMethod": payMethod,
          "receiveMethod": receiveMethod,
          "items": items,
          "total": total,
          "customerName": finalCustomerName,
          "customerId": finalCustomerId
        }
      },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ success: false, message: "ไม่พบรายการที่ต้องการแก้ไข" }, { status: 404 });
    }

    if (!isChangingLinkedCustomer) {
      customer.idNumber = normalizedCustomerId;
      customer.nationality = normalizedNationality;
      await customer.save();
    }

    // กรณีแก้เลขเอกสารของลูกค้าคนเดิม ให้ปรับตัวเชื่อมในรายการเก่าทั้งหมด
    if (
      originalCustomer &&
      !isChangingLinkedCustomer &&
      normalizedOriginalCustomerId !== normalizedCustomerId
    ) {
      await Record.updateMany(
        { customerId: normalizedOriginalCustomerId, _id: { $ne: updated._id } },
        { $set: { customerId: normalizedCustomerId } }
      );
    }

    const recordJson = updated.toObject();
    return NextResponse.json({
      success: true,
      message: "อัปเดตเรียบร้อยแล้ว",
      record: {
        ...recordJson,
        customer: {
          fullName: customer.fullName,
          nationality: customer.nationality,
          idType: customer.idType,
          idNumber: customer.idNumber,
        },
      },
    });
  } catch (error) {
    if (error?.code === 11000) {
      return NextResponse.json(
        { success: false, message: "มีลูกค้าเลขบัตร/พาสปอร์ตนี้อยู่แล้ว" },
        { status: 409 }
      );
    }
    console.error("Update error:", error);
    return NextResponse.json({ success: false, message: "เกิดข้อผิดพลาด", error: error.message }, { status: 500 });
  }
}

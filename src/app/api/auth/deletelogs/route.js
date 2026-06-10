import { connectMongoDB } from "../../../../../lib/mongodb";
import DeleteLog from "../../../../../models/deleteLog";

export async function GET(req) {
  try {
    await connectMongoDB();

    const { searchParams } = new URL(req.url);
    const docNumber = searchParams.get("docNumber");

    // 🔎 ถ้ามี docNumber → หาเฉพาะรายการเดียว
    if (docNumber) {
      const log = await DeleteLog.findOne({ docNumber }).lean();
      return Response.json({ log });
    }

    // 📋 ถ้าไม่มี → ส่งทั้งหมด
    const logs = await DeleteLog.find()
      .sort({ deletedAt: -1 })
      .lean();

    return Response.json({ logs });

  } catch (error) {
    console.error("DeleteLogs API Error:", error);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}


import mongoose from "mongoose";
import { NextResponse } from "next/server";
import Customer from "../../../../models/Customer"; // adjust path if your models live elsewhere

// ---- Mongo connection helper (cached) ----
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URL;
if (!MONGODB_URI) {
  console.warn("[customers API] Missing MONGODB_URI env");
}

let conn = global._mongoose_conn;
async function dbConnect() {
  if (conn && mongoose.connection.readyState === 1) return;
  if (!conn) {
    conn = mongoose.connect(MONGODB_URI, {
      maxPoolSize: 10,
    });
    global._mongoose_conn = conn;
  }
  await conn;
}

// ---- Utils ----
function normalizeIdNumber(idNumber) {
  return String(idNumber || "").replace(/[\s-]+/g, "").toUpperCase();
}

// GET /api/customers
// - Find single:   /api/customers?idType=passport&idNumber=AB123456
// - Search/list:   /api/customers?q=jo&page=1&limit=20
export async function GET(req) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const idType = searchParams.get("idType");
    const idNumber = searchParams.get("idNumber");
    const q = searchParams.get("q");

    // If idType + idNumber present -> find single
    if (idType && idNumber) {
      const doc = await Customer.findOne({
        idType,
        idNumber: normalizeIdNumber(idNumber),
      }).lean();

      if (!doc) {
        return NextResponse.json({ message: "Not found" }, { status: 404 });
      }
      // match model's toJSON transform (expose id)
      const { _id, __v, ...rest } = doc;
      return NextResponse.json({ id: String(_id), ...rest });
    }

    // Otherwise list/search
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20", 10), 1), 100);
    const skip = (page - 1) * limit;

    const filter = {};
    if (q) {
      const regex = new RegExp(q.trim().replace(/\s+/g, ".*"), "i");
      Object.assign(filter, {
        $or: [
          { fullName: regex },
          { idNumber: new RegExp(q.replace(/\s|-+/g, ""), "i") },
          { nationality: new RegExp(`^${q}$`, "i") },
        ],
      });
    }

    const [items, total] = await Promise.all([
      Customer.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
      Customer.countDocuments(filter),
    ]);

    const mapped = items.map(({ _id, __v, ...rest }) => ({ id: String(_id), ...rest }));

    return NextResponse.json({
      page,
      limit,
      total,
      items: mapped,
    });
  } catch (err) {
    console.error("[GET /api/customers] Error:", err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

// POST /api/customers
// Body: { fullName, nationality, idType, idNumber, branch?, createdBy?, notes?, isActive? }
export async function POST(req) {
  try {
    await dbConnect();
    const body = await req.json();

    const {
      fullName,
      nationality,
      idType,
      idNumber,
      branch = "",
      createdBy = "",
      notes = "",
      isActive = true,
    } = body || {};

    if (!fullName || !nationality || !idType || !idNumber) {
      return NextResponse.json(
        { message: "fullName, nationality, idType, idNumber เป็นฟิลด์บังคับ" },
        { status: 400 }
      );
    }

    // Normalize before create (align with model)
    const payload = {
      fullName: String(fullName).replace(/\s+/g, " ").trim(),
      nationality: String(nationality).toUpperCase().trim(),
      idType,
      idNumber: normalizeIdNumber(idNumber),
      branch: String(branch || ""),
      createdBy: String(createdBy || ""),
      notes: String(notes || ""),
      isActive: Boolean(isActive),
    };

    // Attempt create
    const created = await Customer.create(payload);
    const json = created.toJSON();
    return NextResponse.json(json, { status: 201 });
  } catch (err) {
    // Handle duplicate (unique index on idType+idNumber)
    if (err?.code === 11000) {
      return NextResponse.json(
        { message: "มีข้อมูลลูกค้ารหัสเอกสารนี้อยู่แล้ว (idType+idNumber ซ้ำ)" },
        { status: 409 }
      );
    }
    console.error("[POST /api/customers] Error:", err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
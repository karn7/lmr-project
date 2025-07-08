export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { connectMongoDB } from "../../../../../lib/mongodb";
import DailyStock from "../../../../../models/dailyStocks";
import Record from "../../../../../models/record";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const branch = searchParams.get("branch");
  const date   = searchParams.get("date");         // 2025-07-10

  if (!branch || !date)
    return NextResponse.json(
      { message: "branch & date required" },
      { status: 400 }
    );

  await connectMongoDB();

  /* ---------- 1. หาเอกสารสต๊อก “รอบปิดก่อนหน้า” ---------- */
  const yesterdayDoc = await DailyStock
    .findOne({ branch, date: { $lt: date } })      // < 10 ก.ค.
    .sort({ date: -1 })                            // เอาล่าสุด (9 ก.ค.)
    .lean();

  const carryMap  = new Map();  // currency → carryOver
  const rateYMap  = new Map();  // currency → averageRate (Y)

  if (yesterdayDoc) {
    for (const i of yesterdayDoc.items) {
      carryMap.set(i.currency, i.carryOver ?? 0);
      rateYMap.set(i.currency,  i.averageRate ?? 0);
    }
  }

  /* ---------- 2. รวบรวม Record ‘Buying’ ของวันเลือก ---------- */
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end   = new Date(date);
  end.setHours(23, 59, 59, 999);

  const records = await Record.find({
    branch,
    payType: "Buying",
    createdAt: { $gte: start, $lte: end },
  }).lean();

  const inOutMap = new Map();  // currency → total amount
  const rateTMap = new Map();  // currency → { totalRate, count }

  for (const rec of records) {
    for (const item of rec.items) {
      // ยอดวันนี้
      inOutMap.set(
        item.currency,
        (inOutMap.get(item.currency) ?? 0) + (item.amount ?? 0)
      );

      // เรทวันนี้ (สะสมไว้เพื่อหาค่าเฉลี่ย)
      const r = rateTMap.get(item.currency) ?? { total: 0, count: 0 };
      r.total += item.rate;
      r.count += 1;
      rateTMap.set(item.currency, r);
    }
  }

  /* ---------- 3. รวมข้อมูลสองวันให้เป็นออบเจกต์เดียว ---------- */
  const allCurrencies = new Set([
    ...carryMap.keys(),
    ...inOutMap.keys(),
    ...rateTMap.keys(),
  ]);

  const items = Array.from(allCurrencies).map((cur) => {
    const carry    = carryMap.get(cur)  ?? 0;
    const inout    = inOutMap.get(cur)  ?? 0;

    const rY       = rateYMap.get(cur)  ?? 0;
    const rTobj    = rateTMap.get(cur)  ?? { total: 0, count: 0 };
    const rT       = rTobj.count ? (rTobj.total / rTobj.count) : 0;

    return {
      currency     : cur,
      carryOver    : carry,     // ยอดยกมา
      rateY        : rY,        // เรท Y (เมื่อวาน)
      inOutTotal   : inout,     // ยอดเข้า/ออกวันนี้
      rateT        : parseFloat(rT.toFixed(4)),  // เรท T (เฉลี่ยวันนี้)
    };
  });

  return NextResponse.json({ items }, { status: 200 });
}
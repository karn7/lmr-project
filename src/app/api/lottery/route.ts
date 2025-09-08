// app/api/reports/lottery/route.ts
export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { connectMongoDB } from "../../../../lib/mongodb";
import Record from "../../../../models/record";

function parseRange(range: string | null, dateStr: string | null) {
  const base = dateStr ? new Date(dateStr) : new Date();
  const start = new Date(base);
  start.setHours(0, 0, 0, 0);

  if (range === "month") {
    const mStart = new Date(start.getFullYear(), start.getMonth(), 1);
    const mEnd = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    return { start: mStart, end: mEnd, range: "month" };
  }

  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end, range: "day" };
}

export async function GET(req: Request) {
  await connectMongoDB();

  const { searchParams } = new URL(req.url);
  const range = searchParams.get("range"); // "day" | "month"
  const date = searchParams.get("date");   // "YYYY-MM-DD"
  const branch = searchParams.get("branch"); // optional exact match
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");

  let { start, end, range: resolvedRange } = parseRange(range, date);
  if (startParam && endParam) {
    const s = new Date(startParam);
    s.setHours(0, 0, 0, 0);
    const e = new Date(endParam);
    e.setHours(0, 0, 0, 0);
    e.setDate(e.getDate() + 1); // make end exclusive
    start = s;
    end = e;
    resolvedRange = "custom";
  }

  const match: any = {
    payType: "Lottery",
    createdAt: { $gte: start, $lt: end },
  };
  if (branch && branch.trim()) {
    match.branch = branch.trim();
  }

  // pipeline หลัก: ได้ทั้ง summary และ rows รายการ
  const pipeline = [
    { $match: match },
    {
      $facet: {
        summary: [
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              sumTotal: { $sum: "$total" },
            },
          },
          { $project: { _id: 0, count: 1, sumTotal: 1 } },
        ],
        // รวมตามสกุลเงิน (ถ้า items มี currency/amount/total)
        perCurrency: [
          { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },
          {
            $group: {
              _id: "$items.currency",
              amountSum: { $sum: { $ifNull: ["$items.amount", 0] } },
              totalSum:  { $sum: { $ifNull: ["$items.total",  0] } },
            },
          },
          { $project: { currency: "$_id", _id: 0, amountSum: 1, totalSum: 1 } },
          { $sort: { currency: 1 } },
        ],
        // รายการแต่ละบิล
        rows: [
          {
            $project: {
              _id: 0,
              docNumber: 1,
              branch: { $ifNull: ["$branch", "Unknown"] },
              employee: 1,
              createdAt: 1,
              total: 1,
              items: {
                $map: {
                  input: { $ifNull: ["$items", []] },
                  as: "it",
                  in: {
                    currency: "$$it.currency",
                    amount: "$$it.amount",
                    total:  "$$it.total",
                  },
                },
              },
            },
          },
          { $sort: { createdAt: 1 } },
        ],
      },
    },
    {
      $project: {
        summary: { $ifNull: [{ $arrayElemAt: ["$summary", 0] }, { count: 0, sumTotal: 0 }] },
        perCurrency: 1,
        rows: 1,
      },
    },
  ];

  const [result] = await (Record as any).aggregate(pipeline).allowDiskUse(true);

  return NextResponse.json({
    ok: true,
    range: resolvedRange,
    branch: branch ?? null,
    start,
    end,
    summary: result?.summary ?? { count: 0, sumTotal: 0 },
    perCurrency: result?.perCurrency ?? [],
    rows: result?.rows ?? [],
  });
}

import { NextResponse } from "next/server";
import { connectMongoDB } from "../../../../lib/mongodb";
import Record from "../../../../models/record";

function parseRange(range, dateStr) {
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

export async function GET(req) {
  await connectMongoDB();

  const { searchParams } = new URL(req.url);
  const range = searchParams.get("range");     // "day" | "month"
  const date = searchParams.get("date");       // YYYY-MM-DD
  const branch = searchParams.get("branch");   // optional

  const { start, end, range: resolvedRange } = parseRange(range, date);

  const match = {
    payType: { $in: ["deposit", "Deposit"] },
    createdAt: { $gte: start, $lt: end },
  };
  if (branch && branch.trim()) match.branch = branch.trim();

  const pipeline = [
    { $match: match },
    {
      $facet: {
        summary: [
          { $group: { _id: null, count: { $sum: 1 }, sumTotal: { $sum: "$total" } } },
          { $project: { _id: 0, count: 1, sumTotal: 1 } },
        ],
        byNote: [
          {
            $group: {
              _id: { $ifNull: ["$receiveMethodNote", "(ไม่ระบุ)"] },
              count: { $sum: 1 },
              sumTotal: { $sum: "$total" },
            },
          },
          { $project: { _id: 0, receiveMethodNote: "$_id", count: 1, sumTotal: 1 } },
          { $sort: { receiveMethodNote: 1 } },
        ],
      },
    },
    {
      $project: {
        summary: { $ifNull: [{ $arrayElemAt: ["$summary", 0] }, { count: 0, sumTotal: 0 }] },
        byNote: 1,
      },
    },
  ];

  const [result] = await Record.aggregate(pipeline).allowDiskUse(true);

  return NextResponse.json({
    ok: true,
    range: resolvedRange,
    branch: branch ?? "",
    start,
    end,
    summary: result?.summary ?? { count: 0, sumTotal: 0 },
    byNote: result?.byNote ?? [],
  });
}
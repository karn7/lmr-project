import { NextResponse } from "next/server";
import { connectMongoDB } from "../../../../../lib/mongodb";
import Record from "../../../../../models/record";

export async function GET(req) {
  try {
    await connectMongoDB();

    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");

    let match = {
      "items.unit": /Fee/i
    };

    if (dateParam) {
      const start = new Date(dateParam);
      const end = new Date(dateParam);
      end.setHours(23, 59, 59, 999);
      match.createdAt = { $gte: start, $lte: end };
    }

    const results = await Record.aggregate([
      { $match: match },
      { $unwind: "$items" },
      { $match: { "items.unit": /Fee/i } },
      {
        $group: {
          _id: {
            currency: "$items.currency",
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            branch: "$branch"
          },
          totalFee: { $sum: "$items.total" }
        }
      },
      {
        $project: {
          _id: 0,
          currency: "$_id.currency",
          date: "$_id.date",
          branch: "$_id.branch",
          totalFee: 1
        }
      },
      { $sort: { date: 1, currency: 1 } }
    ]);

    return NextResponse.json({ data: results });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
import { NextResponse } from "next/server";
import { connectMongoDB } from "../../../../lib/mongodb";
import Record from "../../../../models/record";

export async function POST(req) {
  try {
    const { branch, date } = await req.json();
    await connectMongoDB();

    const start = new Date(date);
    const end = new Date(date);
    end.setDate(end.getDate() + 1);

    // result[currency] = { buy: number, sell: number }
    const result = {};

    const records = await Record.find({
      branch,
      createdAt: { $gte: start, $lt: end },
    });

    for (const record of records) {
      const { items = [], payType } = record;

      for (const item of items) {
        const { currency, amount } = item;
        if (!currency) continue;

        if (!result[currency]) {
          result[currency] = { buy: 0, sell: 0 };
        }

        if (payType === "Buying") {
          result[currency].buy += parseFloat(amount);
        } else if (payType === "Selling" || payType === "Wholesale") {
          result[currency].sell += parseFloat(amount);
        }
      }
    }

    const formatted = Object.entries(result).map(([currency, { buy, sell }]) => ({
      currency,
      buyTotal: buy,
      sellTotal: sell,
      inOutTotal: buy - sell,
    }));
    return NextResponse.json({ data: formatted }, { status: 200 });
  } catch (err) {
    console.error("❌ Error in stock-diff-today:", err);
    return NextResponse.json({ message: "Error", error: err.message }, { status: 500 });
  }
}
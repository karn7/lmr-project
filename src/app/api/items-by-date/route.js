import { connectMongoDB } from "../../../../lib/mongodb";
import Record from "../../../../models/record";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    await connectMongoDB();
    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const payTypeParam = searchParams.get("payType");
    const payTypes = payTypeParam ? payTypeParam.split(",") : [];

    if (!start || !end) {
      return NextResponse.json({ error: "Missing start or end date" }, { status: 400 });
    }

    const startDateObj = new Date(start);
    const endDateObj = new Date(end);
    endDateObj.setHours(23, 59, 59, 999);
    const query = {
      createdAt: {
        $gte: startDateObj,
        $lte: endDateObj,
      },
    };

    if (payTypes.length > 0) {
      query.payType = { $in: payTypes };
    }

    const records = await Record.find(query).sort({ createdAt: 1 });

    const grouped = {};

    records.forEach((rec) => {
      const date = rec.createdAt.toISOString().split("T")[0];
      if (!grouped[date]) grouped[date] = [];
      rec.items.forEach((item) => {
        grouped[date].push({
          docNumber: rec.docNumber,
          currency: item.currency,
          amount: item.amount,
          rate: item.rate,
          total: item.total,
        });
      });
    });

    const result = Object.entries(grouped).map(([date, items]) => ({
      date,
      items,
    }));

    return NextResponse.json({ records: result });
  } catch (error) {
    console.error("Error in items-by-date:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
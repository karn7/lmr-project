import fs from "fs";
import path from "path";
import { connectMongoDB } from "../../../../../lib/mongodb";
import DailyStock from "../../../../../models/dailyStocks";
import PDFDocument from "pdfkit";
import { PassThrough } from "stream";

export const runtime = "nodejs";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const branch = searchParams.get("branch");
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (!branch || !start || !end) {
      return new Response(JSON.stringify({ message: "Missing branch/start/end" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    await connectMongoDB();

    const stocks = await DailyStock.find({
      branch,
      date: { $gte: start, $lte: end },
    }).sort({ date: 1, currency: 1 });

    const groupedByDate = stocks.reduce((acc, stock) => {
      if (!acc[stock.date]) acc[stock.date] = [];
      acc[stock.date].push(stock);
      return acc;
    }, {});

    const doc = new PDFDocument();
    const stream = new PassThrough();
    doc.pipe(stream);

    const fontPath = path.join(process.cwd(), "public/fonts/THSarabun.ttf");
    doc.registerFont("THSarabun", fs.readFileSync(fontPath));
    doc.font("THSarabun");
    doc.fontSize(16).text(`Daily Stock Report`, { align: "center" }).moveDown();
    doc.fontSize(12).text(`Branch: ${branch}`);
    doc.text(`Date Range: ${start} to ${end}`).moveDown();

    for (const [date, entries] of Object.entries(groupedByDate)) {
      doc.fontSize(13).text(`📅 Date: ${date}`);
      entries.forEach((item) => {
        doc.fontSize(11).text(
          `• ${item.currency} | Carry Over: ${item.carryOver} | In/Out: ${item.inOutTotal} | Average Rate: ${item.averageRate} | Actual: ${item.actual} | Difference: ${item.difference}`
        );
      });
      doc.moveDown();
    }

    doc.end();

    return new Response(stream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=DailyStock-${branch}-${start}_to_${end}.pdf`,
      },
    });
  } catch (error) {
    console.error("❌ Failed to generate PDF:", error);
    return new Response(JSON.stringify({ message: "Failed to generate PDF", error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
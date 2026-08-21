import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { connectMongoDB } from "../../../../../lib/mongodb";
import Record from "../../../../../models/record";
import User from "../../../../../models/user";

export const dynamic = "force-dynamic";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatNumber(value, options = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return number.toLocaleString("th-TH", options);
}

function signatureDataUrl(signature) {
  if (!signature?.image) return "";
  const contentType = signature.contentType || "image/png";
  const buffer = Buffer.isBuffer(signature.image)
    ? signature.image
    : Buffer.from(signature.image.buffer || signature.image);
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

function makeDateRangeQuery(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);

  return {
    $or: [
      { date: { $gte: startDate, $lte: endDate } },
      { createdAt: { $gte: start, $lt: end } },
    ],
  };
}

function makePayTypeQuery(payType) {
  if (payType === "Selling") {
    return { $in: ["Selling", "Wholesale"] };
  }
  return payType;
}

function displayPayTypeFilter(payType) {
  return payType === "Selling" ? "Selling / Wholesale" : payType;
}

function renderReceipt(record, employeeSignatureSrc) {
  const items = Array.isArray(record.items) ? record.items : [];
  const grouped = items.reduce((acc, item) => {
    const currency = item.currency || "-";
    if (!acc[currency]) acc[currency] = [];
    acc[currency].push(item);
    return acc;
  }, {});
  const customerSignatureSrc = signatureDataUrl(record.customerSignature);
  const isMoneyInOut = ["deposit", "withdraw"].includes(record.payType);

  return `
    <section class="receipt">
      <h1>EXCHANGE RECEIPT</h1>
      <p class="center brand">มันนี่เมท เคอเรนซี่ เอ็กซ์เชนจ์</p>
      <p class="center small">MoneyMate Currency Exchange</p>
      <p class="center small">305 ม.10 ถ.มิตรภาพ ต.โพธิ์ชัย อ.เมือง จ.หนองคาย</p>
      <p class="center small">0910608858 , 0642849169</p>
      <p class="center small">เลขที่ใบอนุญาต : MC425670002</p>
      <hr />
      <div class="meta">Trans No: ${escapeHtml(record.docNumber)}</div>
      <div class="meta">Date: ${escapeHtml(new Date(record.createdAt).toLocaleString("en-US"))}</div>
      <div class="meta">Customer Name: ${escapeHtml(record.customerName)}</div>
      <hr />
      <table>
        <thead>
          <tr>
            <th>${escapeHtml(record.payType)}</th>
            <th>Amount</th>
            <th>Rate</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(grouped)
            .map(([currency, groupItems]) => {
              const groupTotal = groupItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
              return `
                ${groupItems
                  .map(
                    (item) => `
                      <tr>
                        <td>${escapeHtml(`${item.currency || ""}${item.unit || ""}`)}</td>
                        <td>${formatNumber(item.amount)}</td>
                        <td class="rate">${escapeHtml(item.rate)}</td>
                        <td>${formatNumber(item.total)}</td>
                      </tr>
                    `
                  )
                  .join("")}
                ${
                  isMoneyInOut
                    ? ""
                    : `<tr><td colspan="4" class="group-total">${escapeHtml(currency)} = ${formatNumber(groupTotal)}</td></tr>`
                }
                <tr><td colspan="4"><hr /></td></tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
      ${
        isMoneyInOut
          ? ""
          : `<div class="total">TOTAL THB: ${formatNumber(record.total, { minimumFractionDigits: 2 })}</div>`
      }
      <div class="signatures">
        <div class="signature-box">
          <div class="signature-image">
            ${employeeSignatureSrc ? `<img src="${employeeSignatureSrc}" alt="Employee Signature" />` : ""}
          </div>
          <div class="signature-line"></div>
          <div>Issued by:</div>
          <div>${escapeHtml(record.employee)}</div>
        </div>
        <div class="signature-box">
          <div class="signature-image">
            ${customerSignatureSrc ? `<img src="${customerSignatureSrc}" alt="Customer Signature" />` : ""}
          </div>
          <div class="signature-line"></div>
          <div>Customer ${escapeHtml(record.customerName)}</div>
        </div>
      </div>
      <div class="notice">
        <p>กรุณาตรวจสอบจำนวนเงินให้ถูกต้อง ถือว่าลูกค้าได้ตรวจสอบและรับเงินครบถ้วนแล้ว</p>
        <p>Please verify the amount. It is deemed that the customer has checked and received the full amount.</p>
      </div>
      ${
        record.payMethod && record.receiveMethod
          ? `<div class="method">${record.payMethod === "cash" ? "C" : "T"}/${record.receiveMethod === "cash" ? "C" : "T"}</div>`
          : ""
      }
    </section>
  `;
}

function renderDocument(records, signatureMap, filters) {
  return `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <title>Receipts ${escapeHtml(filters.startDate)} to ${escapeHtml(filters.endDate)}</title>
  <style>
    @page { size: A5 portrait; margin: 10mm; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #f3f4f6; color: #111827; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
    .toolbar { position: sticky; top: 0; z-index: 1; display: flex; gap: 12px; align-items: center; justify-content: space-between; padding: 12px 16px; background: #fff; border-bottom: 1px solid #e5e7eb; font-family: Arial, sans-serif; }
    .toolbar button { border: 0; border-radius: 6px; padding: 8px 14px; color: #fff; background: #2563eb; font-weight: 700; cursor: pointer; }
    .toolbar .summary { font-size: 13px; color: #374151; }
    .receipt { width: 148mm; min-height: 200mm; margin: 16px auto; padding: 24px; background: #fff; page-break-after: always; font-size: 12px; }
    h1 { margin: 0; text-align: center; font-size: 18px; line-height: 1.3; }
    p { margin: 0; }
    hr { border: 0; border-top: 1px solid #111827; margin: 8px 0; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 4px; text-align: left; }
    th, td { padding: 2px 4px; vertical-align: top; }
    thead { border-bottom: 1px solid #111827; }
    .center { text-align: center; }
    .brand { font-weight: 700; font-size: 16px; }
    .small, .meta { font-size: 12px; }
    .rate { max-width: 60px; overflow-wrap: anywhere; }
    .group-total, .total { font-weight: 700; }
    .signatures { display: flex; justify-content: space-between; gap: 32px; margin-top: 36px; padding: 0 24px; text-align: center; }
    .signature-box { width: 50%; }
    .signature-image { height: 90px; display: flex; align-items: flex-end; justify-content: center; overflow: hidden; }
    .signature-image img { max-width: 100%; max-height: 90px; object-fit: contain; }
    .signature-line { border-top: 1px solid #111827; margin: 0 auto 4px; width: 80%; }
    .notice { margin-top: 24px; text-align: center; font-size: 11px; font-style: italic; }
    .method { margin-top: 8px; text-align: right; font-size: 10px; }
    .empty { margin: 32px auto; width: min(720px, calc(100% - 32px)); padding: 24px; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; font-family: Arial, sans-serif; }
    @media print {
      body { background: #fff; }
      .toolbar { display: none; }
      .receipt { margin: 0 auto; box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="summary">
      ใบเสร็จ ${records.length} รายการ | วันที่ ${escapeHtml(filters.startDate)} ถึง ${escapeHtml(filters.endDate)}
      | สาขา ${escapeHtml(filters.branch || "ทั้งหมด")} | ประเภท ${escapeHtml(displayPayTypeFilter(filters.payType) || "ทั้งหมด")}
    </div>
    <button type="button" onclick="window.print()">พิมพ์ / Save as PDF</button>
  </div>
  ${
    records.length
      ? records.map((record) => renderReceipt(record, signatureMap.get(record.docNumber) || "")).join("")
      : `<div class="empty">ไม่พบใบเสร็จตามเงื่อนไขที่เลือก</div>`
  }
</body>
</html>`;
}

export async function GET(req) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token || token.role !== "admin") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const branch = searchParams.get("branch") || "";
    const payType = searchParams.get("payType") || "";

    if (!startDate || !endDate) {
      return NextResponse.json({ message: "กรุณาเลือกช่วงวันที่" }, { status: 400 });
    }

    await connectMongoDB();

    const query = makeDateRangeQuery(startDate, endDate);
    if (branch) query.branch = branch;
    if (payType) query.payType = makePayTypeQuery(payType);

    const records = await Record.find(query).sort({ createdAt: 1 }).lean();
    const employeeKeys = Array.from(
      new Set(records.map((record) => record.employeeCode || record.employee).filter(Boolean))
    );
    const users = employeeKeys.length
      ? await User.find({
          $or: [{ employeeCode: { $in: employeeKeys } }, { name: { $in: employeeKeys } }],
        })
          .select("name employeeCode employeeSignature")
          .lean()
      : [];

    const userSignatureByKey = new Map();
    users.forEach((user) => {
      const dataUrl = signatureDataUrl(user.employeeSignature);
      if (!dataUrl) return;
      if (user.employeeCode) userSignatureByKey.set(user.employeeCode, dataUrl);
      if (user.name) userSignatureByKey.set(user.name, dataUrl);
    });

    const signatureMap = new Map(
      records.map((record) => [
        record.docNumber,
        userSignatureByKey.get(record.employeeCode) || userSignatureByKey.get(record.employee) || "",
      ])
    );
    const html = renderDocument(records, signatureMap, { startDate, endDate, branch, payType });
    const filenameParts = ["receipts", startDate, "to", endDate, branch, payType].filter(Boolean);
    const filename = `${filenameParts.join("-").replace(/[^\w.-]+/g, "_")}.html`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Receipt export error:", error);
    return NextResponse.json(
      { message: "บันทึกใบเสร็จไม่สำเร็จ", error: error.message },
      { status: 500 }
    );
  }
}

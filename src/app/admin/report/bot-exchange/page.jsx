"use client";

import { useState } from "react";

export default function BotExchangeReportPage() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [payType, setPayType] = useState("Buying"); // หรือค่าที่คุณใช้จริงในฐานข้อมูล เช่น "P" / "NP"
  const [branch, setBranch] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCopyColumn = (colIndex) => {
    if (!rows.length) return;

    // กำหนดชื่อหัวคอลัมน์แต่ละอัน
    const headers = [
      "เลขที่รายการ",
      "วันที่",
      "ประเภทลูกค้า",
      "ชื่อลูกค้า",
      "ประเภทเอกสาร",
      "เลขที่ลูกค้า",
      "สัญชาติ",
      "สกุลเงิน",
      "เรท",
      "จำนวน",
      "รวมเป็นเงิน",
    ];

    // ฟังก์ชันเลือกค่าตามคอลัมน์
    const accessors = [
      (row) => row.docNumber ?? "",
      (row) => row.date ?? "",
      (row) => row.customerType ?? "",
      (row) => row.customerName ?? "",
      (row) => row.idTypeCode ?? "",
      (row) => row.customerId ?? "",
      (row) => row.nationality ?? "",
      (row) => row.currency ?? "",
      (row) => row.rate ?? "",
      (row) => row.amount ?? "",
      (row) => row.total ?? "",
    ];

    const accessor = accessors[colIndex] || (() => "");

    const lines = rows.map((row) => String(accessor(row) ?? ""));
    const text = lines.join("\n");

    // ใช้ Clipboard API ถ้ามี
    if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          alert("คัดลอกข้อมูลคอลัมน์แล้ว");
        })
        .catch(() => {
          // fallback
          const textarea = document.createElement("textarea");
          textarea.value = text;
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand("copy");
          document.body.removeChild(textarea);
          alert("คัดลอกข้อมูลคอลัมน์แล้ว");
        });
    } else {
      // fallback สำหรับกรณีที่ Clipboard API ใช้ไม่ได้
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      alert("คัดลอกข้อมูลคอลัมน์แล้ว");
    }
  };

  const handleFetch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setRows([]);

    try {
      if (!startDate || !endDate) {
        setError("กรุณาเลือกวันที่เริ่มต้นและวันที่สิ้นสุด");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/records-joined", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate,
          endDate,
          payType,
          branch,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "เกิดข้อผิดพลาดในการดึงข้อมูล");
      }

      const data = await res.json();

      const records = data?.data || [];

      // แปลง records ให้กลายเป็น "รายการย่อย" ตาม items
      const flattened = records.flatMap((rec) => {
        const customerNationality = (rec.nationality || "").toUpperCase();

        // แปลงวันที่จาก createdAt ให้เหลือแค่ "วัน" (ตัวเลขวันที่)
        let dayOnly = "";
        if (rec.createdAt) {
          const d = new Date(rec.createdAt);
          if (!isNaN(d)) {
            dayOnly = String(d.getDate()).padStart(2, "0");
          }
        }

        const customerType =
          customerNationality === "TH" || customerNationality === "THA"
            ? "คนไทย"
            : "ชาวต่างชาติ";

        const displayNationality =
          customerNationality === "TH" || customerNationality === "THA"
            ? "TH"
            : customerNationality || "";

        const items = rec.items || [];

        if (items.length === 0) {
          return [
            {
              docNumber: rec.docNumber || "",
              date: dayOnly,
              customerType,
              customerName: rec.customerName || "",
              idTypeCode: rec.idTypeCode ?? "",
              customerId: rec.idNumber || rec.customerId || "",
              nationality: displayNationality,
              currency: "",
              rate: "",
              amount: "",
              total: "",
            },
          ];
        }

        return items.map((item) => ({
          docNumber: rec.docNumber || "",
          date: dayOnly,
          customerType,
          customerName: rec.customerName || "",
          idTypeCode: rec.idTypeCode ?? "",
          customerId: rec.idNumber || rec.customerId || "",
          nationality: displayNationality,
          currency: item.currency || "",
          rate: item.rate ?? "",
          amount: item.amount ?? "",
          total: item.total ?? "",
        }));
      });

      setRows(flattened);
    } catch (err) {
      console.error(err);
      setError(err.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">รายงานสำหรับธนาคารแห่งประเทศไทย (BOT Exchange Report)</h1>

      {/* ฟอร์มเลือกเงื่อนไข */}
      <form onSubmit={handleFetch} className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm mb-1">วันที่เริ่มต้น</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">วันที่สิ้นสุด</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">ประเภท</label>
          <select
            value={payType}
            onChange={(e) => setPayType(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            {/* ปรับ value ให้ตรงกับค่าที่คุณใช้จริงใน record.payType */}
            <option value="Buying">ซื้อ (Buying)</option>
            <option value="Selling">ขาย (Selling)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm mb-1">สาขา</label>
          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="">ทุกสาขา</option>
            <option value="Asawann">Asawann</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm disabled:opacity-60"
        >
          {loading ? "กำลังดึงข้อมูล..." : "แสดง"}
        </button>
      </form>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      <div className="text-xs text-gray-600">
        *คลิกที่หัวคอลัมน์ (แถวสีเทา) เพื่อคัดลอกคอลัมน์นั้นไปวางใน Excel ได้ทันที
      </div>

      {/* ตารางผลลัพธ์ */}
      <div className="overflow-auto border rounded">
        <table id="bot-table" className="min-w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th
                className="border px-2 py-1 text-left cursor-pointer hover:bg-blue-100"
                onClick={() => handleCopyColumn(0)}
              >
                เลขที่รายการ
              </th>
              <th
                className="border px-2 py-1 text-left cursor-pointer hover:bg-blue-100"
                onClick={() => handleCopyColumn(1)}
              >
                วันที่
              </th>
              <th
                className="border px-2 py-1 text-left cursor-pointer hover:bg-blue-100"
                onClick={() => handleCopyColumn(2)}
              >
                ประเภทลูกค้า
              </th>
              <th
                className="border px-2 py-1 text-left cursor-pointer hover:bg-blue-100"
                onClick={() => handleCopyColumn(3)}
              >
                ชื่อลูกค้า
              </th>
              <th
                className="border px-2 py-1 text-left cursor-pointer hover:bg-blue-100"
                onClick={() => handleCopyColumn(4)}
              >
                ประเภทเอกสาร
              </th>
              <th
                className="border px-2 py-1 text-left cursor-pointer hover:bg-blue-100"
                onClick={() => handleCopyColumn(5)}
              >
                เลขที่ลูกค้า
              </th>
              <th
                className="border px-2 py-1 text-left cursor-pointer hover:bg-blue-100"
                onClick={() => handleCopyColumn(6)}
              >
                สัญชาติ
              </th>
              <th
                className="border px-2 py-1 text-left cursor-pointer hover:bg-blue-100"
                onClick={() => handleCopyColumn(7)}
              >
                สกุลเงิน
              </th>
              <th
                className="border px-2 py-1 text-right cursor-pointer hover:bg-blue-100"
                onClick={() => handleCopyColumn(8)}
              >
                เรท
              </th>
              <th
                className="border px-2 py-1 text-right cursor-pointer hover:bg-blue-100"
                onClick={() => handleCopyColumn(9)}
              >
                จำนวน
              </th>
              <th
                className="border px-2 py-1 text-right cursor-pointer hover:bg-blue-100"
                onClick={() => handleCopyColumn(10)}
              >
                รวมเป็นเงิน
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={11} className="border px-2 py-2 text-center text-gray-500">
                  ยังไม่มีข้อมูล
                </td>
              </tr>
            )}

            {rows.map((row, idx) => (
              <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="border px-2 py-1">{row.docNumber}</td>
                <td className="border px-2 py-1">{row.date}</td>
                <td className="border px-2 py-1">{row.customerType}</td>
                <td className="border px-2 py-1">{row.customerName}</td>
                <td className="border px-2 py-1">{row.idTypeCode}</td>
                <td className="border px-2 py-1">{row.customerId}</td>
                <td className="border px-2 py-1">{row.nationality}</td>
                <td className="border px-2 py-1">{row.currency}</td>
                <td className="border px-2 py-1 text-right">{row.rate}</td>
                <td className="border px-2 py-1 text-right">{row.amount}</td>
                <td className="border px-2 py-1 text-right">{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Page({ params }) {
  const { docNumber } = React.use(params);
  const router = useRouter();

  const [record, setRecord] = useState(null);
  const [docLogData, setDocLogData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

  // Fetch deleted record
  useEffect(() => {
    if (!docNumber) return;

    async function fetchDeletedRecord() {
      try {
        setLoading(true);
        const res = await fetch(`${base}/api/auth/deletelogs?docNumber=${docNumber}`);
        if (!res.ok) throw new Error("Failed to load deleted record");
        const data = await res.json();
        if (data.log) {
          setRecord(data.log);
        } else if (Array.isArray(data.logs) && data.logs.length > 0) {
          setRecord(data.logs[0]);
        } else if (data && data.docNumber) {
          setRecord(data);
        } else {
          setRecord(null);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchDeletedRecord();
  }, [docNumber]);

  // Fetch adjustment log by docNumber
  useEffect(() => {
    if (!docNumber) return;

    async function fetchLogs() {
      try {
        const res = await fetch(`${base}/api/AdjustmentLog?docNumber=${docNumber}`);
        const data = await res.json();
        setDocLogData(data.logs || []);
      } catch (err) {
        console.error("Error loading adjustment logs:", err);
      }
    }

    fetchLogs();
  }, [docNumber]);

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;
  if (!record) return <div className="p-6">ไม่พบข้อมูล</div>;

  const data = record.deletedData || {};

  return (
    <div className="p-6 max-w-4xl mx-auto border rounded-md">
      <button
        onClick={() => router.push("/admin/audit/deletelogs")}
        className="mb-4 text-blue-600 hover:underline"
      >
        ← กลับ
      </button>

      <h1 className="text-2xl font-semibold mb-4">รายละเอียดรายการที่ถูกลบ</h1>

      <div className="border p-4 mb-6 space-y-1 text-left">
        <p><strong>เลขที่รายการ:</strong> {record.docNumber}</p>
        <p><strong>เวลาที่ลบ:</strong> {new Date(record.deletedAt).toLocaleString("th-TH")}</p>
        <p><strong>เวลาที่ทำรายการ:</strong> {data.createdAt ? new Date(data.createdAt).toLocaleString("th-TH") : "-"}</p>
        <p><strong>ลบโดย:</strong> <span className="text-red-600">{record.deletedBy}</span></p>
        <p><strong>พนักงาน:</strong> {data.employee}</p>
        <p><strong>กะ:</strong> {data.shiftNo}</p>
        <p><strong>ประเภท:</strong> {data.payType}</p>
        <p><strong>ชื่อลูกค้า:</strong> {data.customerName}</p>
        <p><strong>หมายเหตุ:</strong> {data.note ?? "-"}</p>
      </div>

      <div className="mt-4 bg-yellow-100 text-yellow-900 text-lg font-bold p-4 rounded-md max-w-max">
        จำนวนรวมทั้งหมด: {data.total?.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
      </div>

      <h2 className="text-xl font-semibold mt-6 mb-2">รายการ</h2>
      <table className="min-w-full border text-sm" cellPadding="5">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-3 py-2">Currency</th>
            <th className="border px-3 py-2">Unit</th>
            <th className="border px-3 py-2">Rate</th>
            <th className="border px-3 py-2">Amount</th>
            <th className="border px-3 py-2">Total</th>
          </tr>
        </thead>
        <tbody>
          {data.items?.length > 0 ? (
            data.items.map((item, index) => (
              <tr key={index} className="even:bg-gray-50">
                <td className="border px-3 py-2">{item.currency}</td>
                <td className="border px-3 py-2">{item.unit ?? "-"}</td>
                <td className="border px-3 py-2">{item.rate?.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                <td className="border px-3 py-2">{item.amount?.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                <td className="border px-3 py-2">{item.total?.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="5" className="text-center p-4">No items found.</td>
            </tr>
          )}
        </tbody>
      </table>

      <h2 className="text-xl font-semibold mt-10 mb-2">การปรับยอดเงิน (Adjustment Log)</h2>
      {docLogData.length > 0 ? (
        <table className="min-w-full border text-sm" cellPadding="5">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-3 py-2">เวลา</th>
              <th className="border px-3 py-2">สกุลเงิน</th>
              <th className="border px-3 py-2">จำนวน</th>
              <th className="border px-3 py-2">ประเภท</th>
              <th className="border px-3 py-2">พนักงาน</th>
            </tr>
          </thead>
          <tbody>
            {docLogData.map((log, index) => (
              <tr
                key={index}
                className={`even:bg-gray-50 ${
                  log.action === "increase"
                    ? "bg-green-100"
                    : log.action === "decrease"
                    ? "bg-red-100"
                    : ""
                }`}
              >
                <td className="border px-3 py-1">{new Date(log.createdAt).toLocaleTimeString("th-TH")}</td>
                <td className="border px-3 py-1">{log.currency}</td>
                <td className="border px-3 py-1">{log.amount?.toLocaleString("th-TH")}</td>
                <td className="border px-3 py-1">{log.action}</td>
                <td className="border px-3 py-1">{log.employee}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="mt-4 text-sm text-gray-500 italic">ไม่มี log ที่เกี่ยวข้องกับรายการนี้</div>
      )}
    </div>
  );
}


"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function DepositReportPage() {
  const router = useRouter();
  const params = useSearchParams();

  const [branch, setBranch] = useState(params.get("branch") || "");
  const [date, setDate] = useState(params.get("date") || new Date().toISOString().slice(0, 10));
  const [range, setRange] = useState(params.get("range") || "day"); // "day" | "month"
  const [branches, setBranches] = useState([]);
  const [data, setData] = useState({ summary: { count: 0, sumTotal: 0 }, byNote: [] });
  const [loading, setLoading] = useState(false);

  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

  // load branches
  useEffect(() => {
    async function loadBranches() {
      try {
        const res = await fetch(`${base}/api/branches`, { cache: "no-store" });
        const list = await res.json();
        const unique = Array.from(new Set(Array.isArray(list) ? list : [])).sort();
        setBranches(unique);
      } catch (e) {
        console.error("โหลดรายชื่อสาขาล้มเหลว", e);
      }
    }
    loadBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams();
    if (branch) qs.set("branch", branch);
    if (date) qs.set("date", date);
    if (range) qs.set("range", range);

    const url = `${base}/api/deposit?${qs.toString()}`;
    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  // load & sync URL
  useEffect(() => {
    load();
    const qs = new URLSearchParams();
    if (branch) qs.set("branch", branch);
    if (date) qs.set("date", date);
    if (range) qs.set("range", range);
    router.replace(`/admin/report/deposit?${qs.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch, date, range]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-4">
        <button onClick={() => router.push("/admin/report/daily")} className="text-blue-600 hover:underline">
          ← กลับรายงานอื่น
        </button>
      </div>

      <h1 className="text-2xl font-semibold mb-4">รายงานการโอนเงิน (Deposit)</h1>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div>
          <label className="block text-sm mb-1">สาขา (Branch)</label>
          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="border rounded px-2 py-1 min-w-[220px]"
          >
            <option value="">ทั้งหมด</option>
            {branches.map((b, i) => (
              <option key={i} value={b}>{b}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm mb-1">วันที่อ้างอิง</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border rounded px-2 py-1"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">ช่วง</label>
          <select value={range} onChange={(e) => setRange(e.target.value)} className="border rounded px-2 py-1">
            <option value="day">รายวัน (1 วัน)</option>
            <option value="month">รายเดือน (ทั้งเดือน)</option>
          </select>
        </div>

        <button
          onClick={load}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "กำลังโหลด..." : "โหลดข้อมูล"}
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border rounded p-4">
          <div className="text-gray-500 text-sm">จำนวนรายการทั้งหมด</div>
          <div className="text-2xl font-bold">{data?.summary?.count ?? 0}</div>
        </div>
        <div className="bg-white border rounded p-4">
          <div className="text-gray-500 text-sm">ยอดรวมช่วงนี้</div>
          <div className="text-2xl font-bold">
            {(data?.summary?.sumTotal ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-white border rounded p-4">
          <div className="text-gray-500 text-sm">ช่วงเวลา</div>
          <div>
            {data?.start ? new Date(data.start).toLocaleDateString("th-TH") : "-"} —{" "}
            {data?.end ? new Date(data.end).toLocaleDateString("th-TH") : "-"}
          </div>
        </div>
      </div>

      {/* Table by receiveMethodNote */}
      <h2 className="text-lg font-semibold mb-2">สรุปตามประเภท (receiveMethodNote)</h2>
      <table className="min-w-full border text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-3 py-2 text-left">ประเภท (receiveMethodNote)</th>
            <th className="border px-3 py-2 text-right">จำนวนรายการ</th>
            <th className="border px-3 py-2 text-right">ยอดรวม</th>
          </tr>
        </thead>
        <tbody>
          {(data?.byNote ?? []).length === 0 ? (
            <tr><td colSpan={3} className="text-center p-4">ไม่พบข้อมูล</td></tr>
          ) : (
            data.byNote.map((r, i) => (
              <tr key={i} className="even:bg-gray-50">
                <td className="border px-3 py-2">{r.receiveMethodNote}</td>
                <td className="border px-3 py-2 text-right">{r.count}</td>
                <td className="border px-3 py-2 text-right">
                  {(r.sumTotal ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
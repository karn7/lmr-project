"use client";

import React, { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { summarizeLottery } from "../../../../../lib/lottery-report.mjs";

const money = (value) => value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function LotteryReportInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [branch, setBranch] = useState(params.get("branch") || "");
  const [date, setDate] = useState(params.get("date") || new Date().toISOString().slice(0, 10));
  const [range, setRange] = useState(params.get("range") || "day"); // "day" | "month"
  const [startDate, setStartDate] = useState(params.get("start") || new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(params.get("end") || new Date().toISOString().slice(0, 10));
  const [branches, setBranches] = useState([]);
  const [data, setData] = useState({ summary: { count: 0, sumTotal: 0 }, rows: [], perCurrency: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [calculated, setCalculated] = useState(false);
  const requestId = useRef(0);
  const groups = summarizeLottery(data?.rows ?? []);
  const canCalculate = (data?.rows ?? []).length > 0 && groups.every((g) => !g.invalid && (g.percent !== null || g.count === 0));

  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

  useEffect(() => {
    async function loadBranches() {
      try {
        const res = await fetch(`${base}/api/branches`, { cache: "no-store" });
        const list = await res.json();
        // ป้องกันค่าซ้ำ และเรียงชื่อ
        const unique = Array.from(new Set(Array.isArray(list) ? list : [])).sort();
        setBranches(unique);
        // ถ้า URL ไม่มี branch และมีค่าแรก ให้ตั้งค่าเริ่มต้นเป็น "ทั้งหมด" (ค่าว่าง)
      } catch (e) {
        console.error("โหลดรายชื่อสาขาล้มเหลว", e);
      }
    }
    loadBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    const id = ++requestId.current;
    setLoading(true);
    setCalculated(false);
    setError("");
    const qs = new URLSearchParams();
    if (branch) qs.set("branch", branch);
    if (date) qs.set("date", date);
    if (range) qs.set("range", range);
    if (range === 'custom') {
      if (startDate) qs.set('start', startDate);
      if (endDate) qs.set('end', endDate);
    }
    const url = `${base}/api/lottery?${qs.toString()}`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง");
      const json = await res.json();
      if (id === requestId.current) setData(json);
    } catch (e) {
      if (id === requestId.current) {
        setError("โหลดข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง");
        setData({ rows: [], perCurrency: [], summary: {} });
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // sync URL
    const qs = new URLSearchParams();
    if (branch) qs.set("branch", branch);
    if (date) qs.set("date", date);
    if (range) qs.set("range", range);
    if (range === 'custom') {
      if (startDate) qs.set('start', startDate);
      if (endDate) qs.set('end', endDate);
    }
    router.replace(`/admin/report/lottery?${qs.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch, date, range, startDate, endDate]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-4">
        <button onClick={() => router.push("/admin/report/daily")} className="text-blue-600 hover:underline">
          ← กลับรายวัน
        </button>
      </div>

      <h1 className="text-2xl font-semibold mb-4">รายงาน Lottery (รายวัน/รายเดือน)</h1>

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
        {range === 'custom' && (
          <>
            <div>
              <label className="block text-sm mb-1">เริ่มวันที่ (Start)</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border rounded px-2 py-1"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">ถึงวันที่ (End)</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border rounded px-2 py-1"
              />
            </div>
          </>
        )}
        <div>
          <label className="block text-sm mb-1">ช่วง</label>
          <select value={range} onChange={(e) => setRange(e.target.value)} className="border rounded px-2 py-1">
            <option value="day">รายวัน (1 วัน)</option>
            <option value="month">รายเดือน (ทั้งเดือนของวันที่เลือก)</option>
            <option value="custom">กำหนดช่วงเอง</option>
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

      {error && <p role="alert" className="mb-4 text-red-600">{error}</p>}

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border rounded p-4">
          <div className="text-gray-500 text-sm">ยอดรวม(ใบ)</div>
          <div className="text-2xl font-bold">
            {((data?.perCurrency ?? []).reduce((acc, r) => acc + (r?.amountSum ?? 0), 0)) || 0}
          </div>
        </div>
        <div className="bg-white border rounded p-4">
          <div className="text-gray-500 text-sm">ยอดจ่ายให้ลูกค้าช่วงนี้ (บาท)</div>
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

      <section className="mb-6" aria-busy={loading}>
        <h2 className="text-lg font-semibold mb-2">สรุปแยกประเภทสลาก</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groups.filter((g) => g.percent !== null || g.count || g.invalid).map((g) => (
            <div key={g.type} className="border rounded p-4 bg-white">
              <h3 className="font-semibold mb-2">{g.type}</h3>
              <p>จำนวน {g.count.toLocaleString("th-TH")} ใบ</p>
              <p>มูลค่ารางวัลเต็ม: {g.invalid ? "ข้อมูลไม่ครบ" : `${money(g.gross)} บาท`}</p>
              <p>ยอดจ่ายให้ลูกค้า: {money(g.paid)} บาท</p>
              {g.percent !== null && <p className="text-sm text-gray-600">หักเมื่อแลกกับกองสลาก {g.percent}%</p>}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setCalculated(true)}
          disabled={loading || !!error || !canCalculate}
          className="mt-4 bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800 disabled:opacity-50"
        >
          คำนวณเงินที่จะได้รับจากกองสลาก
        </button>
        <p className="mt-2 text-sm text-gray-600">คำนวณจากมูลค่ารางวัลเต็ม (รางวัลต่อใบ × จำนวนใบ) ตามข้อมูลช่วงวันที่และสาขาที่เลือก</p>
        {!loading && groups.some((g) => g.invalid || (g.percent === null && g.count > 0)) && (
          <p role="alert" className="mt-2 text-red-600">ไม่สามารถคำนวณได้ เนื่องจากบางรายการไม่มีมูลค่ารางวัลหรือไม่ทราบประเภทสลาก กรุณาตรวจสอบข้อมูล</p>
        )}
        {calculated && !loading && canCalculate && (
          <div className="mt-4 overflow-x-auto" aria-live="polite">
            <table className="min-w-full border text-sm">
              <thead className="bg-gray-100">
                <tr>
                  {["ประเภทสลาก", "มูลค่ารางวัลเต็ม (บาท)", "อัตราหัก", "ยอดหัก (บาท)", "รับสุทธิ (บาท)"].map((label) => <th key={label} className="border px-3 py-2">{label}</th>)}
                </tr>
              </thead>
              <tbody>
                {groups.filter((g) => g.percent !== null).map((g) => (
                  <tr key={g.type}>
                    <td className="border px-3 py-2">{g.type}</td>
                    <td className="border px-3 py-2 text-right">{money(g.gross)}</td>
                    <td className="border px-3 py-2 text-right">{g.percent}%</td>
                    <td className="border px-3 py-2 text-right">{money(g.deduction)}</td>
                    <td className="border px-3 py-2 text-right font-semibold">{money(g.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-lg font-bold text-green-800">รวมเงินที่จะได้รับ: {money(groups.reduce((sum, g) => sum + g.net, 0))} บาท</p>
          </div>
        )}
      </section>

      {/* Per-currency (optional) */}
      {Array.isArray(data?.perCurrency) && data.perCurrency.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">สรุปตามรายการ</h2>
          <table className="min-w-full border">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-3 py-2 text-left">รางวัล</th>
                <th className="border px-3 py-2 text-right">รวม (ใบ)</th>
                <th className="border px-3 py-2 text-right">เป็นเงินรวม</th>
              </tr>
            </thead>
            <tbody>
              {data.perCurrency.map((r, i) => (
                <tr key={i} className="even:bg-gray-50">
                  <td className="border px-3 py-2">{r.currency ?? "-"}</td>
                  <td className="border px-3 py-2 text-right">
                    {(r.amountSum ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="border px-3 py-2 text-right">
                    {(r.totalSum ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Rows detail (แต่ละรายการมีจำนวนเท่าไหร่) */}
      <h2 className="text-lg font-semibold mb-2">รายละเอียดแต่ละรายการ</h2>
      <table className="min-w-full border text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-3 py-2 text-left">เวลา</th>
            <th className="border px-3 py-2 text-left">Doc</th>
            <th className="border px-3 py-2 text-left">สาขา</th>
            <th className="border px-3 py-2 text-left">พนักงาน</th>
            <th className="border px-3 py-2 text-left">รายการ (currency: amount ⇒ total)</th>
            <th className="border px-3 py-2 text-right">ยอดรวมบิล</th>
          </tr>
        </thead>
        <tbody>
          {(data?.rows ?? []).length === 0 ? (
            <tr><td colSpan={6} className="text-center p-4">ไม่พบข้อมูล</td></tr>
          ) : (
            data.rows.map((r, idx) => (
              <tr key={idx} className="even:bg-gray-50">
                <td className="border px-3 py-2">
                  {new Date(r.createdAt).toLocaleString("th-TH")}
                </td>
                <td className="border px-3 py-2">{r.docNumber}</td>
                <td className="border px-3 py-2">{r.branch ?? "-"}</td>
                <td className="border px-3 py-2">{r.employee ?? "-"}</td>
                <td className="border px-3 py-2">
                  {Array.isArray(r.items) && r.items.length > 0 ? (
                    <ul className="list-disc pl-4">
                      {r.items.map((it, i2) => (
                        <li key={i2}>
                          {it.currency ?? "-"}:{" "}
                          {(it.amount ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })} ⇒{" "}
                          {(it.total ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                        </li>
                      ))}
                    </ul>
                  ) : "—"}
                </td>
                <td className="border px-3 py-2 text-right">
                  {(r.total ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function LotteryReportPage() {
  return (
    <Suspense fallback={<div className="p-6">กำลังโหลด...</div>}>
      <LotteryReportInner />
    </Suspense>
  );
}

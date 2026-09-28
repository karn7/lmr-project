"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function DepositList({ records }) {
  if (!records.length) return <p className="p-4 text-center text-gray-500">ไม่พบรายการ</p>;

  return (
    <ol className="divide-y">
      {records.map((record) => {
        const depositItems = (record.items ?? []).filter((item) => item.unit?.trim().toLowerCase() === "deposit");
        const feeItems = (record.items ?? []).filter((item) => item.unit?.trim().toLowerCase() === "fee" && Number(item.total) > 0);
        return (
        <li key={record._id} className="p-4 bg-white">
          <div className="flex flex-wrap justify-between gap-2">
            <time dateTime={record.createdAt} className="text-sm text-gray-600">
              {new Date(record.createdAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "medium" })}
            </time>
            <span className="text-sm font-medium">{record.receiveMethodNote || "ไม่ระบุช่องทาง"}</span>
          </div>
          <div className="flex flex-wrap justify-between gap-2 mt-2">
            <span className="font-medium break-all">{record.docNumber || "ไม่มีเลขที่เอกสาร"}</span>
            <div className="font-semibold text-right text-green-600">
              {depositItems.length ? depositItems.map((item, index) => (
                <p key={index}>ยอดโอน: {(Number(item.total) || 0).toLocaleString("th-TH", { maximumFractionDigits: 2 })} {item.currency || ""}</p>
              )) : (
                <p>ยอดโอน: {(record.total ?? 0).toLocaleString("th-TH", { maximumFractionDigits: 2 })}</p>
              )}
            </div>
          </div>
          {feeItems.map((fee, index) => (
            <p key={index} className="text-sm mt-1 text-right text-gray-600">
              ค่าธรรมเนียม (Fee): {(Number(fee.total) || 0).toLocaleString("th-TH", { maximumFractionDigits: 2 })} {fee.currency || ""}
            </p>
          ))}
          <p className="text-sm mt-2 break-words">ลูกค้า: {record.customerName || "-"}</p>
          <p className="text-sm text-gray-600 break-words">สาขา: {record.branch || "-"} · พนักงาน: {record.employee || "-"}</p>
          {record.note && <p className="text-sm mt-1 whitespace-pre-wrap break-words">หมายเหตุ: {record.note}</p>}
        </li>
        );
      })}
    </ol>
  );
}

function DepositReportInner() {
  const router = useRouter();
  const params = useSearchParams();

  const [branch, setBranch] = useState(params.get("branch") || "");
  const [date, setDate] = useState(params.get("date") || new Date().toISOString().slice(0, 10));
  const [range, setRange] = useState(params.get("range") || "day"); // "day" | "month"
  const [employee, setEmployee] = useState(params.get("employee") || "");
  const [employees, setEmployees] = useState([]);
  const [branches, setBranches] = useState([]);
  const [data, setData] = useState({ summary: { count: 0, sumTotal: 0 }, byNote: [] });
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState("channels");
  const records = data?.records ?? [];
  const channelOf = (record) => (record.receiveMethodNote || "").trim().toUpperCase();
  const otherRecords = records.filter((record) => !["NOUKKY", "BECOME"].includes(channelOf(record)));

  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

  // load branches
  useEffect(() => {
    async function loadBranches() {
      try {
        const res = await fetch(`${base}/api/branches`, { cache: "no-store" });
        const data = await res.json();
        const uniqueBranches = Array.from(new Set(Array.isArray(data.branches) ? data.branches : [])).sort();
        setBranches(uniqueBranches);
        setEmployees(Array.isArray(data.employees) ? data.employees.sort() : []);
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
    if (employee) qs.set("employee", employee);

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
    if (employee) qs.set("employee", employee);
    router.replace(`/admin/report/deposit?${qs.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch, date, range, employee]);

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
          <label className="block text-sm mb-1">พนักงาน (Employee)</label>
          <select
            value={employee}
            onChange={(e) => setEmployee(e.target.value)}
            className="border rounded px-2 py-1 min-w-[220px]"
          >
            <option value="">ทั้งหมด</option>
            {employees.map((emp, i) => (
              <option key={i} value={emp}>{emp}</option>
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
            {(data?.summary?.sumTotal ?? 0).toLocaleString("th-TH", { maximumFractionDigits: 2 })}
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
                  {(r.sumTotal ?? 0).toLocaleString("th-TH", { maximumFractionDigits: 2 })}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <section className="mt-8" aria-label="รายการโอนเงิน">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold">รายการโอนเงิน ({records.length})</h2>
          <div className="flex gap-2" role="group" aria-label="มุมมองรายการ">
            {[
              ["channels", "แยก NOUKKY / BECOME"],
              ["timeline", "เรียงตามเวลา"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                onClick={() => setView(value)}
                className={`border rounded px-3 py-2 text-sm ${view === value ? "bg-blue-600 text-white border-blue-600" : "bg-white hover:bg-gray-100"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-3">เรียงตามเวลาเก่าไปใหม่</p>
        {view === "channels" ? (
          <>
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              {["NOUKKY", "BECOME"].map((channel) => {
                const channelRecords = records.filter((record) => channelOf(record) === channel);
                return (
                  <div key={channel} className="min-w-0 border rounded overflow-hidden">
                    <h3 className="bg-gray-100 p-3 font-semibold">{channel} ({channelRecords.length})</h3>
                    <DepositList records={channelRecords} />
                  </div>
                );
              })}
            </div>
            {otherRecords.length > 0 && (
              <div className="border rounded overflow-hidden mt-4">
                <h3 className="bg-gray-100 p-3 font-semibold">ช่องทางอื่น / ไม่ระบุ ({otherRecords.length})</h3>
                <DepositList records={otherRecords} />
              </div>
            )}
          </>
        ) : (
          <div className="border rounded overflow-hidden">
            <DepositList records={records} />
          </div>
        )}
      </section>
    </div>
  );
}

export default function DepositReportPage() {
  return (
    <Suspense fallback={<div className="p-6">กำลังโหลด...</div>}>
      <DepositReportInner />
    </Suspense>
  );
}

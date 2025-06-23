"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MissingLogPage() {
  const [date, setDate] = useState("");
  const [employee, setEmployee] = useState("");
  const [result, setResult] = useState([]);
  const [employees, setEmployees] = useState([]);
  const router = useRouter();

  useEffect(() => {
    const fetchEmployees = async () => {
      const res = await fetch("/api/record");
      const data = await res.json();
      const names = data.records.map(r => r.employee).filter(Boolean);
      const unique = [...new Set(names)];
      setEmployees(unique);
    };
    fetchEmployees();
  }, []);

  const handleCheck = async () => {
    const res = await fetch(`/api/check-missing-log?date=${date}&employee=${employee}`);
    const data = await res.json();
    setResult(data.missingLogs);
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">ตรวจสอบรายการที่ไม่มี Log</h1>

      <div className="space-y-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border p-2 rounded"
        />
        <input
          type="text"
          placeholder="ชื่อพนักงาน"
          value={employee}
          onChange={(e) => setEmployee(e.target.value)}
          className="border p-2 rounded"
          list="employee-list"
        />
        <datalist id="employee-list">
          {employees.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <button
          onClick={handleCheck}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          ตรวจสอบ
        </button>
      </div>

      <div className="mt-6">
        {Array.isArray(result) && result.length > 0 ? (
          <table className="w-full border mt-4 text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2">เลขที่รายการ</th>
                <th className="border p-2">วันที่</th>
                <th className="border p-2">พนักงาน</th>
                <th className="border p-2">ประเภท</th>
                <th className="border p-2">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {result.map((r) => (
                <tr
                  key={r.docNumber}
                  className={`${r.missing ? "bg-red-100" : ""} cursor-pointer hover:bg-gray-200`}
                  onClick={() => window.open(`/admin/report/daily/dailylist/${r.docNumber}`, "_blank")}
                >
                  <td className="border p-2">{r.docNumber}</td>
                  <td className="border p-2">{r.date}</td>
                  <td className="border p-2">{r.employeeName}</td>
                  <td className="border p-2">{r.type}</td>
                  <td className="border p-2">
                    {r.missing ? "❌ ไม่มี Log" : "✅ มี Log แล้ว"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-4 text-gray-600">ไม่พบรายการที่ไม่มี Log</p>
        )}
      </div>
    </div>
  );
}
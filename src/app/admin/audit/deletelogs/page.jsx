"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const router = useRouter();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/auth/deletelogs");

      if (!res.ok) {
        const errorText = await res.text();
        console.error("API Error:", res.status, errorText);
        return;
      }

      const data = await res.json();
      setLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch (err) {
      console.error("Fetch failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">ประวัติรายการที่ถูกลบ</h1>

      {loading ? (
        <p>กำลังโหลด...</p>
      ) : logs.length === 0 ? (
        <p>ไม่พบข้อมูล</p>
      ) : (
        <div className="overflow-x-auto border rounded">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 border">เวลา</th>
                <th className="p-2 border">เลขที่รายการ</th>
                <th className="p-2 border">พนักงาน</th>
                <th className="p-2 border">สาขา</th>
                <th className="p-2 border">ยอดรวม</th>
                <th className="p-2 border">ลบโดย</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log._id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => router.push(`/admin/audit/deletelogs/${log.docNumber}`)}
                >
                  <td className="p-2 border">
                    {new Date(log.deletedAt).toLocaleString()}
                  </td>

                  <td className="p-2 border font-semibold text-blue-600">
                    {log.docNumber}
                  </td>

                  <td className="p-2 border">
                    {log.deletedData?.employee}
                  </td>

                  <td className="p-2 border">
                    {log.deletedData?.branch}
                  </td>

                  <td className="p-2 border text-right">
                    {log.deletedData?.total?.toLocaleString()}
                  </td>

                  <td className="p-2 border text-red-600 font-medium">
                    {log.deletedBy}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
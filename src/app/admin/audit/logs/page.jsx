"use client";

import React from "react";
import AdminNav from "../../components/AdminNav";
import AdminLayout from "../../components/AdminLayout";
import Container from "../../components/Container";
import Footer from "../../components/Footer";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";

function LogsPage() {
  const { data: session } = useSession();

  const [logs, setLogs] = React.useState([]);
  const [selectedDate, setSelectedDate] = React.useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });

  const [selectedCurrency, setSelectedCurrency] = React.useState("all");
  const [selectedEmployee, setSelectedEmployee] = React.useState("all");

  React.useEffect(() => {
    if (!session) {
      redirect(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/login`);
    } else if (session?.user?.role !== "admin") {
      redirect(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/welcome`);
    }
  }, [session]);

  React.useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch(`/api/AdjustmentLog?date=${selectedDate}`);
        const data = await res.json();
        setLogs(data.logs || []);
      } catch (err) {
        console.error("Error fetching logs:", err);
      }
    };
    fetchLogs();
  }, [selectedDate]);

  const filteredLogs = logs.filter(log =>
    (selectedCurrency === "all" || log.currency === selectedCurrency) &&
    (selectedEmployee === "all" || log.employee === selectedEmployee)
  );

  return (
    <Container>
      <div className="hidden md:block">
        <AdminNav session={session} />
      </div>
      <div className="flex-grow">
        <AdminLayout>
          <div className="p-4 bg-white rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Audit Logs</h2>
            <div className="mb-4">
              <label className="mr-2 text-sm text-gray-700">เลือกวันที่:</label>
              <input
                type="date"
                className="border px-2 py-1 text-sm"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
              />
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-4">
              <div>
                <label className="mr-2 text-sm text-gray-700">สกุลเงิน:</label>
                <select
                  className="border px-2 py-1 text-sm"
                  value={selectedCurrency}
                  onChange={(e) => setSelectedCurrency(e.target.value)}
                >
                  <option value="all">ทั้งหมด</option>
                  {[...new Set(logs.map(log => log.currency))].sort().map(currency => (
                    <option key={currency} value={currency}>{currency}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mr-2 text-sm text-gray-700">พนักงาน:</label>
                <select
                  className="border px-2 py-1 text-sm"
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                >
                  <option value="all">ทั้งหมด</option>
                  {[...new Set(logs.map(log => log.employee))].sort().map(emp => (
                    <option key={emp} value={emp}>{emp}</option>
                  ))}
                </select>
              </div>
            </div>

            <table className="w-full text-sm text-left text-gray-700 border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 border">เวลา</th>
                  <th className="p-2 border">ประเภท</th>
                  <th className="p-2 border">สกุล</th>
                  <th className="p-2 border">จำนวน</th>
                  <th className="p-2 border">ก่อนปรับ</th>
                  <th className="p-2 border">หลังปรับ</th>
                  <th className="p-2 border">โดย</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr><td colSpan="7" className="text-center p-4">ไม่พบข้อมูล</td></tr>
                ) : (
                  filteredLogs.map((log, index) => (
                    <tr
                      key={index}
                      onClick={() => window.open(`/admin/report/daily/dailylist/${log.docNumber}`, "_blank")}
                      className="cursor-pointer hover:bg-gray-100"
                    >
                      <td className="p-2 border">{new Date(log.createdAt).toLocaleTimeString()}</td>
                      <td className={`p-2 border ${log.action === "increase" ? "text-green-600" : "text-red-600"}`}>
                        {log.action}
                      </td>
                      <td className="p-2 border">{log.currency}</td>
                      <td className="p-2 border">{log.amount.toLocaleString()}</td>
                      <td className="p-2 border">{log.beforeAmount.toLocaleString()}</td>
                      <td className="p-2 border">{log.afterAmount.toLocaleString()}</td>
                      <td className="p-2 border">{log.employee}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </AdminLayout>
      </div>
      <Footer />
    </Container>
  );
}

export default LogsPage;
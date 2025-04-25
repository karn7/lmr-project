"use client"
import { useRouter } from 'next/navigation';

import React, { useState, useEffect } from 'react'
import AdminNav from '../../components/AdminNav'
import Container from '../../components/Container'
import Footer from '../../components/Footer'
import SideNav from '../../components/SideNav'

import { useSession, signOut } from 'next-auth/react'
import { redirect } from 'next/navigation'

function ReportPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const [records, setRecords] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
    const [selectedBranch, setSelectedBranch] = useState("ทั้งหมด");
    const [selectedEmployee, setSelectedEmployee] = useState("ทั้งหมด");
    const [selectedType, setSelectedType] = useState("ทั้งหมด");
    const [branches, setBranches] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [types, setTypes] = useState([]);
    const [showDailyReport, setShowDailyReport] = useState(false);
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
    
    useEffect(() => {
      if (showDailyReport) {
        // fetch records
        fetch(`${basePath}/api/record`)
          .then((res) => res.json())
          .then((data) => {
            setRecords(data.records);
            const allBranches = Array.from(new Set(data.records.map((r) => r.branch)));
            setBranches(allBranches);
            setTypes(Array.from(new Set(data.records.map((r) => r.payType))));
          });
      }
    }, [showDailyReport]);

    useEffect(() => {
      fetch(`${basePath}/api/shifts`)
        .then((res) => res.json())
        .then((data) => {
          setShifts(data.shifts || []);
          const allBranches = Array.from(new Set(data.shifts.map(s => s.branch)));
          setBranches(allBranches);
        });
    }, []);
    
    const uniqueEmployees = Array.isArray(records)
      ? Array.from(
          new Set(
            records
              .filter((r) => selectedBranch === "ทั้งหมด" || r.branch === selectedBranch)
              .map((r) => r.employee)
          )
        )
      : [];
    
    const filtered = shifts.filter((s) => {
      const dateMatch = new Date(s.date).toISOString().split("T")[0] === selectedDate;
      const branchMatch = selectedBranch === "ทั้งหมด" || s.branch === selectedBranch;
      return dateMatch && branchMatch;
    });
    
    useEffect(() => {
      if (!session) {
        redirect(`${basePath}/login`);
      } else if (session?.user?.role !== "admin") {
        redirect(`${basePath}/welcome`);
      } else if (session?.user?.lastLoginDate) {
        const last = new Date(session.user.lastLoginDate);
        const now = new Date();

        const isNewDay = last.getFullYear() !== now.getFullYear()
                      || last.getMonth() !== now.getMonth()
                      || last.getDate() !== now.getDate();

        if (isNewDay) {
          alert("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
          signOut();
        }
      }
    }, [session]);

  return (
    <Container>
      <div className="flex flex-col min-h-screen">
        <AdminNav session={session} />
        <div className="flex flex-grow px-6 mt-6">
          <div className="w-64 mr-6">
            <SideNav />
          </div>
          <div className="flex-grow">
            <div className="border rounded-lg p-4 bg-white shadow-sm w-max mb-6">
              <div className="flex space-x-4">
                <button
                  onClick={() => router.push(`${basePath}/admin/report/daily`)}
                  className="bg-gray-400 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded"
                >
                  รายงานประจำวัน
                </button>
                <button
                  onClick={() => router.push(`${basePath}/admin/report/cash-drawer`)}
                  className="bg-gray-400 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded"
                >
                  รายงานลิ้นชักเก็บเงิน
                </button>
                <button
                  onClick={() => router.push(`${basePath}/admin/report/shift-summary`)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded"
                >
                  รายงานเปิดปิดร้าน
                </button>
              </div>
            </div>
            <div className="border rounded-lg p-6 bg-white shadow-sm">
              <div className="flex flex-wrap items-end gap-4 mb-4">
                <label className="flex flex-col text-sm font-medium">
                  วันที่:
                  <input
                    type="date"
                    className="border p-2 rounded w-32 h-10"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                </label>
                <label className="flex flex-col text-sm font-medium">
                  สาขา:
                  <select
                    className="border p-2 rounded w-32 h-10"
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                  >
                    <option>ทั้งหมด</option>
                    {branches.map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </select>
                </label>
              </div>

              <table className="w-full text-left border mb-10">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 border">สาขา</th>
                    <th className="p-2 border">พนักงาน</th>
                    <th className="p-2 border">รอบ</th>
                    <th className="p-2 border">ดู</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s._id}>
                      <td className="p-2 border">{s.branch}</td>
                      <td className="p-2 border">{s.employee}</td>
                      <td className="p-2 border">{s.shiftNo}</td>
                      <td className="p-2 border">
                        <button
                          onClick={() => window.open(`${basePath}/summary/${s._id}`, "_blank")}
                          className="text-blue-600 underline"
                        >
                          ดูรายละเอียด
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    </Container>
  )
}

export default ReportPage
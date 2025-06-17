"use client"

export const dynamic = "force-dynamic";
import { useRouter } from 'next/navigation';

import React, { useState, useEffect } from 'react'
import AdminNav from '../../components/AdminNav'
import Container from '../../components/Container'
import Footer from '../../components/Footer'
import AdminLayout from '../../components/AdminLayout'

import { useSession, signOut } from 'next-auth/react'
import { redirect } from 'next/navigation'

function ReportPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const [records, setRecords] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [selectedDate, setSelectedDate] = useState("");
    const [selectedBranch, setSelectedBranch] = useState("ทั้งหมด");
    const [selectedEmployee, setSelectedEmployee] = useState("ทั้งหมด");
    const [selectedType, setSelectedType] = useState("ทั้งหมด");
    const [branches, setBranches] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [types, setTypes] = useState([]);
    const [showDailyReport, setShowDailyReport] = useState(false);
    const [selectedRow, setSelectedRow] = useState(null);
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

    useEffect(() => {
      const today = new Date().toISOString().split("T")[0];
      setSelectedDate(today);
    }, []);
    
    useEffect(() => {
      if (showDailyReport) {
        // fetch records
        fetch(`${basePath}/api/record`, { cache: "no-store" })
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
      fetch(`${basePath}/api/shifts?ts=${Date.now()}`, { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => {
          setShifts(data.shifts || []);
          const allBranches = Array.from(new Set(data.shifts.map(s => s.branch)));
          setBranches(allBranches);
        });
    }, [selectedDate]);
    
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
      const shiftDate = new Date(s.date).toISOString().split("T")[0];
      const dateMatch = shiftDate === selectedDate;
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
      <div className="hidden md:block">
        <AdminNav session={session} />
      </div>
      <div className="flex-grow">
        <AdminLayout session={session}>
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

            {/* Desktop Table */}
            <div className="hidden md:block">
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

            {/* Mobile View */}
            <div className="md:hidden space-y-4">
              {filtered.map((s) => (
                <div
                  key={s._id}
                  className="border rounded p-4 shadow"
                  onClick={() => setSelectedRow(selectedRow === s._id ? null : s._id)}
                >
                  <div><strong>สาขา:</strong> {s.branch}</div>
                  <div><strong>พนักงาน:</strong> {s.employee}</div>
                  <div><strong>รอบ:</strong> {s.shiftNo}</div>
                  {selectedRow === s._id && (
                    <div className="mt-3">
                      <button
                        onClick={() => window.open(`${basePath}/summary/${s._id}`, "_blank")}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
                      >
                        ดูรายละเอียด
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </AdminLayout>
      </div>
      <Footer />
    </Container>
  )
}

export default ReportPage
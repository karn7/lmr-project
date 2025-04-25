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
    const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
    const [selectedBranch, setSelectedBranch] = useState("ทั้งหมด");
    const [selectedEmployee, setSelectedEmployee] = useState("ทั้งหมด");
    const [selectedType, setSelectedType] = useState("ทั้งหมด");
    const [branches, setBranches] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [types, setTypes] = useState([]);
    const [showDailyReport, setShowDailyReport] = useState(false);

    const [cashDrawerEntries, setCashDrawerEntries] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchCashDrawer = async () => {
      setLoading(true);
      try {
        const shiftNos = [1, 2, 3]; // สมมุติว่ามี 3 รอบต่อวัน
        let allEntries = [];

        for (const shiftNo of shiftNos) {
          const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/cashdrawer?user=${selectedEmployee}&date=${selectedDate}&shiftNo=${shiftNo}`);
          if (res.ok) {
            const data = await res.json();
            if (data.entries.length > 0) {
              allEntries.push({
                shiftNo,
                entries: data.entries,
              });
            }
          }
        }

        setCashDrawerEntries(allEntries);
      } catch (err) {
        console.error("Error fetching cash drawer:", err);
      } finally {
        setLoading(false);
      }
    };
    
    useEffect(() => {
      fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/cashdrawer?list=employees`)
        .then(res => res.json())
        .then(data => {
          setEmployees(data.employees || []);
        })
        .catch(err => console.error("Error fetching employee list:", err));
    }, []);
    
    useEffect(() => {
      if (!session) {
        redirect(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/login`);
      } else if (session?.user?.role !== "admin") {
        redirect(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/welcome`);
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

    useEffect(() => {
      if (selectedDate && selectedEmployee) {
        fetchCashDrawer();
      }
    }, [selectedDate, selectedEmployee]);

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
                  onClick={() => router.push(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/admin/report/daily`)}
                  className="bg-gray-400 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded"
                >
                  รายงานประจำวัน
                </button>
                <button
                  onClick={() => router.push(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/admin/report/cash-drawer`)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded"
                >
                  รายงานลิ้นชักเก็บเงิน
                </button>
                <button
                  onClick={() => router.push(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/admin/report/shift-summary`)}
                  className="bg-gray-400 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded"
                >
                  รายงานเปิดปิดร้าน
                </button>
              </div>
            </div>
            <div className="border rounded-lg p-6 bg-white shadow-sm">
              <div className="mb-6 flex flex-wrap items-end gap-4">
                <label className="flex flex-col text-sm font-medium">
                  วันที่:
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="border px-2 py-1 w-40"
                  />
                </label>
                <label className="flex flex-col text-sm font-medium">
                  ชื่อพนักงาน:
                  <select
                    value={selectedEmployee}
                    onChange={(e) => setSelectedEmployee(e.target.value)}
                    className="border px-2 py-1 w-40"
                  >
                    <option value="ทั้งหมด">-- เลือกพนักงาน --</option>
                    {employees.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {loading ? (
                <p>กำลังโหลดข้อมูล...</p>
              ) : (
                cashDrawerEntries.map((group, index) => (
                  <div key={index} className="border rounded p-4 mb-6">
                    <h2 className="text-lg font-semibold mb-2">
                      วันที่: {selectedDate} | รอบที่: {group.shiftNo}
                    </h2>
                    <table className="table-auto w-full border">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border px-4 py-2">ประเภท</th>
                          <th className="border px-4 py-2">สกุลเงิน</th>
                          <th className="border px-4 py-2">จำนวนเงิน</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.entries.map((entry, idx) => (
                          <tr key={idx}>
                            <td className="border px-4 py-2">{entry.type === "in" ? "นำเข้า" : entry.type === "out" ? "นำออก" : "-"}</td>
                            <td className="border px-4 py-2">{entry.currency}</td>
                            <td className={`border px-4 py-2 text-right ${entry.amount < 0 ? "text-red-500" : ""}`}>
                              {Number(entry.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        <Footer />
      </div>
    </Container>
  )
}

export default ReportPage
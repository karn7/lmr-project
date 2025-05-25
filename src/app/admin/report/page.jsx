"use client"
import { useRouter } from 'next/navigation';

import React, { useState, useEffect } from 'react'
import AdminNav from '../components/AdminNav'
import Container from '../components/Container'
import Footer from '../components/Footer'
import SideNav from '../components/SideNav'

import Content from '../components/Content'

import { useSession, signOut } from 'next-auth/react'
import { redirect } from 'next/navigation'

function ReportPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const [records, setRecords] = useState([]);
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
    
    const uniqueEmployees = Array.isArray(records)
      ? Array.from(
          new Set(
            records
              .filter((r) => selectedBranch === "ทั้งหมด" || r.branch === selectedBranch)
              .map((r) => r.employee)
          )
        )
      : [];
    
    const filtered = records.filter((r) => {
      const dateMatch = new Date(r.createdAt).toISOString().split("T")[0] === selectedDate;
      const branchMatch = selectedBranch === "ทั้งหมด" || r.branch === selectedBranch;
      const employeeMatch = selectedEmployee === "ทั้งหมด" || r.employee === selectedEmployee;
      const typeMatch = selectedType === "ทั้งหมด" || r.payType === selectedType;
      return dateMatch && branchMatch && employeeMatch && typeMatch;
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
            <div className="border rounded-lg p-4 bg-white shadow-sm mb-6 w-max">
              <div className="flex space-x-4">
                <button
                  onClick={() => router.push(`${basePath}/admin/report/daily`)}
                  className="bg-gray-400 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded"
                >
                  รายงานประจำวัน
                </button>
                <button
                  onClick={() => router.push(`${basePath}/admin/report/report-by-date`)}
                  className="bg-gray-400 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded"
                >
                  พิมพ์รายงานประจำวัน
                </button>
                <button
                  onClick={() => router.push(`${basePath}/admin/report/cash-drawer`)}
                  className="bg-gray-400 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded"
                >
                  รายงานลิ้นชักเก็บเงิน
                </button>
                <button
                  onClick={() => router.push(`${basePath}/admin/report/shift-summary`)}
                  className="bg-gray-400 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded"
                >
                  รายงานเปิดปิดร้าน
                </button>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    </Container>
  )
}

export default ReportPage
// Add AdminNav import at the top
"use client"
import AdminNav from '../../components/AdminNav';
import { useRouter } from 'next/navigation';

import React, { useState, useEffect } from 'react'
import AdminLayout from '../../components/AdminLayout'
import Footer from '../../components/Footer'

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
    const [types, setTypes] = useState([]);
    const [sortKey, setSortKey] = useState(null);
    const [sortOrder, setSortOrder] = useState("asc");
    const [selectedRow, setSelectedRow] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [hasLoaded, setHasLoaded] = useState(false);

    const resetRecords = () => {
      setRecords([]);
      setBranches([]);
      setTypes([]);
      setSelectedBranch("ทั้งหมด");
      setSelectedEmployee("ทั้งหมด");
      setSelectedType("ทั้งหมด");
      setSelectedRow(null);
      setHasLoaded(false);
      setErrorMessage("");
    };

    const loadRecords = async () => {
      if (!selectedDate) return;

      setIsLoading(true);
      setErrorMessage("");
      setSelectedBranch("ทั้งหมด");
      setSelectedEmployee("ทั้งหมด");
      setSelectedType("ทั้งหมด");
      setSelectedRow(null);

      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/record?date=${encodeURIComponent(selectedDate)}`,
          { cache: "no-store" }
        );
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || data.message || "Failed to fetch records.");
        }

        const fetchedRecords = Array.isArray(data.records) ? data.records : [];

        setRecords(fetchedRecords);
        setBranches(Array.from(new Set(fetchedRecords.map((r) => r.branch).filter(Boolean))));
        setTypes(Array.from(new Set(fetchedRecords.map((r) => r.payType).filter(Boolean))));
        setHasLoaded(true);
      } catch (error) {
        console.error("Error fetching records:", error);
        setRecords([]);
        setBranches([]);
        setTypes([]);
        setErrorMessage("โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
        setHasLoaded(true);
      } finally {
        setIsLoading(false);
      }
    };
    
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
      const branchMatch = selectedBranch === "ทั้งหมด" || r.branch === selectedBranch;
      const employeeMatch = selectedEmployee === "ทั้งหมด" || r.employee === selectedEmployee;
      const typeMatch = selectedType === "ทั้งหมด" || r.payType === selectedType;
      return branchMatch && employeeMatch && typeMatch;
    });

    const sortedFiltered = [...filtered].sort((a, b) => {
      if (!sortKey) return 0;
      let aValue = a[sortKey];
      let bValue = b[sortKey];

      if (sortKey === "createdAt") {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }

      if (typeof aValue === "string") {
        return sortOrder === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else {
        return sortOrder === "asc"
          ? aValue - bValue
          : bValue - aValue;
      }
    });

    const handleSort = (key) => {
      if (sortKey === key) {
        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
      } else {
        setSortKey(key);
        setSortOrder("asc");
      }
    };

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

  return (
    <>
      <div className="hidden md:block">
        <AdminNav session={session} />
      </div>
      <AdminLayout session={session}>
      <div className="flex-grow px-6 mt-6">
        <div className="border rounded-lg p-4 bg-white shadow-sm w-fit mb-6">
          <div className="flex space-x-4">
            <button
              onClick={() => router.push(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/admin/report/report-by-date`)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded"
            >
              พิมพ์รายงาน
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
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  resetRecords();
                }}
              />
            </label>
            <button
              type="button"
              onClick={loadRecords}
              disabled={isLoading || !selectedDate}
              className={`h-10 rounded px-4 font-semibold text-white ${
                isLoading || !selectedDate
                  ? "cursor-not-allowed bg-gray-400"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {isLoading ? "กำลังโหลด..." : "แสดงข้อมูล"}
            </button>
            <label className="flex flex-col text-sm font-medium">
              สาขา:
              <select
                className="border p-2 rounded w-32 h-10"
                value={selectedBranch}
                disabled={!hasLoaded || isLoading}
                onChange={(e) => {
                  setSelectedBranch(e.target.value);
                  setSelectedEmployee("ทั้งหมด");
                }}
              >
                <option>ทั้งหมด</option>
                {branches.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-sm font-medium">
              พนักงาน:
              <select
                className="border p-2 rounded w-32 h-10"
                value={selectedEmployee}
                disabled={!hasLoaded || isLoading}
                onChange={(e) => setSelectedEmployee(e.target.value)}
              >
                <option>ทั้งหมด</option>
                {uniqueEmployees.map((e) => (
                  <option key={e}>{e}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-sm font-medium">
              ประเภท:
              <select
                className="border p-2 rounded w-32 h-10"
                value={selectedType}
                disabled={!hasLoaded || isLoading}
                onChange={(e) => setSelectedType(e.target.value)}
              >
                <option>ทั้งหมด</option>
                {types.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>

          {errorMessage && (
            <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <table className="w-full text-left border mb-10">
            <thead className="bg-gray-100 hidden md:table-header-group">
              <tr>
                <th className="p-2 border cursor-pointer" onClick={() => handleSort('docNumber')}>
                  เลขที่รายการ {sortKey === 'docNumber' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
                <th className="p-2 border cursor-pointer" onClick={() => handleSort('createdAt')}>
                  เวลา {sortKey === 'createdAt' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
                <th className="p-2 border cursor-pointer" onClick={() => handleSort('payType')}>
                  ประเภท {sortKey === 'payType' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
                <th className="p-2 border">ลูกค้าจ่าย</th>
                <th className="p-2 border">ลูกค้ารับ</th>
                <th className="p-2 border cursor-pointer" onClick={() => handleSort('total')}>
                  ยอดรวม {sortKey === 'total' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
                <th className="p-2 border cursor-pointer" onClick={() => handleSort('branch')}>
                  สาขา {sortKey === 'branch' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
                <th className="p-2 border cursor-pointer" onClick={() => handleSort('employee')}>
                  พนักงาน {sortKey === 'employee' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
                <th className="p-2 border">ดู</th>
              </tr>
            </thead>
            {/* Desktop Table */}
            <tbody className="hidden md:table-row-group">
              {!isLoading && hasLoaded && sortedFiltered.map((r) => (
                <tr key={r.docNumber}>
                  <td className="p-2 border">{r.docNumber}</td>
                  <td className="p-2 border">{new Date(r.createdAt).toLocaleTimeString()}</td>
                  <td className="p-2 border">{r.payType}</td>
                  <td className="p-2 border">{r.payMethod}</td>
                  <td className="p-2 border">{r.receiveMethod}</td>
                  <td className="p-2 border">{r.total != null ? Number(r.total).toLocaleString() : "-"}</td>
                  <td className="p-2 border">{r.branch}</td>
                  <td className="p-2 border">{r.employee}</td>
                  <td className="p-2 border">
                    <button
                      className="text-blue-600"
                      onClick={() =>
                        window.open(
                          `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/admin/report/daily/dailylist/${r.docNumber}`,
                          "_blank"
                        )
                      }
                    >
                      ดู
                    </button>
                  </td>
                </tr>
              ))}
              {isLoading && (
                <tr>
                  <td className="p-4 text-center text-gray-500" colSpan={9}>
                    กำลังโหลดข้อมูล...
                  </td>
                </tr>
              )}
              {!isLoading && !hasLoaded && (
                <tr>
                  <td className="p-4 text-center text-gray-500" colSpan={9}>
                    กรุณาเลือกวันที่ แล้วกดแสดงข้อมูล
                  </td>
                </tr>
              )}
              {!isLoading && hasLoaded && sortedFiltered.length === 0 && (
                <tr>
                  <td className="p-4 text-center text-gray-500" colSpan={9}>
                    ไม่พบข้อมูลในวันที่เลือก
                  </td>
                </tr>
              )}
            </tbody>

            {/* Mobile View */}
            <tbody className="md:hidden">
              {!isLoading && hasLoaded && sortedFiltered.map((r) => (
                <tr key={r.docNumber} className="border-b" onClick={() => setSelectedRow(r.docNumber)}>
                  <td className="p-3">
                    <div className="font-semibold">{r.docNumber}</div>
                    <div className="text-sm text-gray-600">เวลา: {new Date(r.createdAt).toLocaleTimeString()}</div>
                    <div className="text-sm text-gray-600">ประเภท: {r.payType}</div>
                    <div className="text-sm text-gray-600">จ่าย: {r.payMethod}</div>
                    <div className="text-sm text-gray-600">รับ: {r.receiveMethod}</div>
                    <div className="text-sm text-gray-600">ยอดรวม: {r.total != null ? Number(r.total).toLocaleString() : "-"}</div>
                    <div className="text-sm text-gray-600">สาขา: {r.branch}</div>
                    <div className="text-sm text-gray-600">พนักงาน: {r.employee}</div>
                    {selectedRow === r.docNumber && (
                      <div className="mt-2">
                        <button
                          className="text-blue-600 underline text-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(
                              `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/admin/report/daily/dailylist/${r.docNumber}`,
                              "_blank"
                            );
                          }}
                        >
                          ดูรายละเอียด
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {isLoading && (
                <tr>
                  <td className="p-4 text-center text-gray-500">
                    กำลังโหลดข้อมูล...
                  </td>
                </tr>
              )}
              {!isLoading && !hasLoaded && (
                <tr>
                  <td className="p-4 text-center text-gray-500">
                    กรุณาเลือกวันที่ แล้วกดแสดงข้อมูล
                  </td>
                </tr>
              )}
              {!isLoading && hasLoaded && sortedFiltered.length === 0 && (
                <tr>
                  <td className="p-4 text-center text-gray-500">
                    ไม่พบข้อมูลในวันที่เลือก
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Footer />
      </AdminLayout>
    </>
  )
}

export default ReportPage

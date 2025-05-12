"use client"

import React, { useState, useEffect, useRef } from 'react'
import AdminNav from '../components/AdminNav'
import Container from '../components/Container'
import Footer from '../components/Footer'
import SideNav from '../components/SideNav'

import { useSession, signOut } from 'next-auth/react'
import { redirect } from 'next/navigation'

function AdminPage() {

    const { data: session } = useSession();
    const [branchBalances, setBranchBalances] = useState([]);
    const [totalBalance, setTotalBalance] = useState({});
    const wasPopupOpen = useRef(false);

    const formatCurrency = (amount) => {
      const formatted = amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      return formatted.endsWith(".00") ? formatted.slice(0, -3) + ".-" : formatted;
    };

    const refreshBalances = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/open-shift/all-balances`);
        const data = await res.json();

        const balances = data.branchBalances || [];
        setBranchBalances(balances);

        const totalsByCurrency = {};
        balances.forEach(branch => {
          const cash = branch.cashBalance || {};
          Object.entries(cash).forEach(([currency, amount]) => {
            if (!totalsByCurrency[currency]) totalsByCurrency[currency] = 0;
            totalsByCurrency[currency] += Number(amount) || 0;
          });
        });

        setTotalBalance(totalsByCurrency);
      } catch (err) {
        console.error("Failed to fetch balances", err);
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

    useEffect(() => {
      if (session?.user?.role === "admin") {
        refreshBalances();
      }
    }, [session]);

  return (
    <Container>
        <AdminNav session={session} />
            <div className='flex-grow'>
                <div className='container mx-auto'>
                    <div className="flex mt-10">
                      <div className="w-1/4 mr-6">
                        <SideNav />
                      </div>
                      <div className="w-3/4">
                        <div className="border rounded-lg p-6 bg-white shadow-sm">
                          <button
                            onClick={refreshBalances}
                            className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                          >
                            🔄 รีเฟรชข้อมูล
                          </button>
                          <button
                            onClick={() => {
                              const win = window.open(
                                "/admin/shift-adjust",
                                "_blank",
                                "width=800,height=600"
                              );
                              const timer = setInterval(() => {
                                if (win.closed) {
                                  clearInterval(timer);
                                  refreshBalances();
                                }
                              }, 500);
                            }}
                            className="ml-2 inline-block px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            ✏️ ปรับยอดเงินกะ
                          </button>
                          <h2 className="text-xl font-bold mb-4">ยอดเงินรวมทั้งหมด:</h2>
                          {Object.keys(totalBalance).length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-2 text-gray-800 mb-4 text-sm">
                              {Object.entries(totalBalance).map(([currency, amount]) => (
                                <div key={currency} className={amount < 0 ? "text-red-600" : ""}>
                                  <span className="font-medium">{currency}:</span> {formatCurrency(amount)}
                                </div>
                              ))}
                            </div>
                          )}
                          {branchBalances.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                              {branchBalances.map((branch, idx) => (
                                <div key={idx} className="border p-4 shadow-md rounded">
                                  <h3 className="font-semibold">สาขา: {branch.branch}</h3>
                                  <p className="mb-2 font-medium">ยอดเงิน:</p>
                                  <ul className="list-disc list-inside mb-2">
                                    {Object.entries(branch.cashBalance || {}).map(([cur, val]) => {
                                      const amount = Number(val);
                                      if (amount === 0) return null;
                                      return (
                                        <li
                                          key={cur}
                                          className={amount < 0 ? "text-red-600" : ""}
                                        >
                                          {cur}: {formatCurrency(amount)}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                  <p>พนักงาน: {branch.employee}</p>
                                  <p>วันที่: {branch.date}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-600">ยังไม่มีข้อมูลการเปิดร้าน</p>
                          )}
                        </div>
                      </div>
                    </div>
                </div>
            </div>
        <Footer />
    </Container>
  )
}

export default AdminPage
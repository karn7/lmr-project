"use client"

import React, { useState, useEffect } from 'react'
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
                          <h2 className="text-xl font-bold mb-4">ยอดเงินรวมทั้งหมด:</h2>
                          {Object.keys(totalBalance).length > 0 && (
                            <ul className="mb-4 list-disc list-inside text-gray-800">
                              {Object.entries(totalBalance).map(([currency, amount]) => (
                                <li
                                  key={currency}
                                  className={amount < 0 ? "text-red-600" : ""}
                                >
                                  {currency}: {formatCurrency(amount)}
                                </li>
                              ))}
                            </ul>
                          )}
                          {branchBalances.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                              {branchBalances.map((branch, idx) => (
                                <div key={idx} className="border p-4 shadow-md rounded">
                                  <h3 className="font-semibold">สาขา: {branch.branch}</h3>
                                  <p className="mb-2 font-medium">ยอดเงิน:</p>
                                  <ul className="list-disc list-inside mb-2">
                                    {Object.entries(branch.cashBalance || {}).map(([cur, val]) => (
                                      <li
                                        key={cur}
                                        className={Number(val) < 0 ? "text-red-600" : ""}
                                      >
                                        {cur}: {formatCurrency(typeof val === "number" ? val : Number(val))}
                                      </li>
                                    ))}
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
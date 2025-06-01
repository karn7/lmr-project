"use client"

import React, { useState, useEffect } from 'react'
import AdminNav from '../components/AdminNav'
import Footer from '../components/Footer'
import SideNav from '../components/SideNav'

import { useSession, signOut } from 'next-auth/react'
import { redirect } from 'next/navigation'
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function AdminPage() {

    const { data: session } = useSession();
    
    const [branches, setBranches] = useState([]);
    const [selectedBranch, setSelectedBranch] = useState("");
    const [calculatedStock, setCalculatedStock] = useState([]);
    const [showStockTable, setShowStockTable] = useState(false);
    const [currencyTitles, setCurrencyTitles] = useState([]);
    const [alreadyCalculated, setAlreadyCalculated] = useState(false);

    const today = new Date().toISOString().split("T")[0];
    const [selectedDateForDailyStock, setSelectedDateForDailyStock] = useState({
      start: "",
      end: "",
    });


    useEffect(() => {
      if (!selectedBranch) return;

      fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/dailystocks/check?branch=${selectedBranch}&date=${today}`)
        .then((res) => res.json())
        .then((data) => {
          setAlreadyCalculated(data.exists);
          // ลบการคำนวณอัตโนมัติ
        });
    }, [selectedBranch]);

    const handleCalculateStock = async () => {
      if (alreadyCalculated) {
        alert("ข้อมูลถูกบันทึกลงสต๊อกแล้ว");
        return;
      }
      // ดึงข้อมูลยอดปิดร้านของเมื่อวาน
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      const carryRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/dailystocks/last-close?branch=${selectedBranch}&date=${yesterdayStr}`);
      const carryJson = await carryRes.json();
      const carryMap = new Map((carryJson.items || []).map(item => [item.currency, item.actual]));

      // ดึงเฉพาะข้อมูลจาก /api/stock-diff-today พร้อมเพิ่ม payType = "Buying"
      const inOutRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/stock-diff-today`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch: selectedBranch, date: today, payType: "Buying" }),
      });
      const inOutJson = await inOutRes.json();

      // เพิ่มการดึงค่า rate ของเมื่อวาน
      const rateYesterdayRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/average-rate-today`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch: selectedBranch, date: yesterdayStr }),
      });
      const rateYesterdayJson = await rateYesterdayRes.json();
      const rateYesterdayMap = new Map((rateYesterdayJson.data || []).map(item => [item.currency, item.averageRate]));

      // ดึงค่า rate ของวันนี้
      const rateTodayRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/average-rate-today`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch: selectedBranch, date: today }),
      });
      const rateTodayJson = await rateTodayRes.json();
      const rateTodayMap = new Map((rateTodayJson.data || []).map(item => [item.currency, item.averageRate]));

      // map currencyTitles ทั้งหมด และรวมข้อมูล inOutJson.data + averageRate และยอดยกมาจาก carryMap
      const mergedStock = currencyTitles.map(({ title }) => {
        const inOutItem = (inOutJson.data || []).find((i) => i.currency === title);
        const inOutTotal = inOutItem?.inOutTotal ?? 0;

        // ถ้า inOut วันนี้ไม่มี และยอดยกมาก็ไม่มี ให้ดึงยอดของเมื่อวานจาก carryMap
        const fallbackInOut = carryMap.get(title) ?? 0;
        const finalInOutTotal = inOutTotal === 0 ? fallbackInOut : inOutTotal;

        const rateY = rateYesterdayMap.get(title) ?? 0;
        const rateT = rateTodayMap.get(title) ?? 0;
        return {
          currency: title,
          carryOver: carryMap.get(title) ?? 0,
          inOutTotal: finalInOutTotal,
          averageRate: inOutItem
            ? (rateY && rateT ? (rateY + rateT) / 2 : rateY || rateT)
            : rateY || 0
        };
      });
      setCalculatedStock(mergedStock);
      console.log("📊 ข้อมูล mergedStock:", mergedStock);
      setShowStockTable(true);
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
      fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/record`)
        .then((res) => res.json())
        .then((data) => {
          const allBranches = Array.from(new Set(data.records.map((r) => r.branch)));
          setBranches(allBranches);
        });
    }, []);

    useEffect(() => {
      fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/posts`)
        .then((res) => res.json())
        .then((data) => {
          const uniqueTitles = [];
          const seen = new Set();
          for (const post of data.posts || []) {
            if (
              !seen.has(post.title) &&
              post.title !== "บาท" &&
              post.title !== "THB"
            ) {
              seen.add(post.title);
              uniqueTitles.push(post);
            }
          }
          setCurrencyTitles(uniqueTitles);
        });
    }, []);

  // Create a map for quick lookup: currency → stock
  const stockMap = new Map(calculatedStock.map((item) => [item.currency, item]));

  // ฟังก์ชันสำหรับสร้าง PDF รายงานสต๊อก
  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`รายงานสต๊อกรายวัน (${selectedBranch})`, 105, 15, { align: "center" });

    autoTable(doc, {
      startY: 25,
      head: [["สกุลเงิน", "ยอดยกมา", "เข้า/ออกวันนี้", "รวมทั้งหมด", "เรทเฉลี่ย"]],
      body: currencyTitles.map((post) => {
        const stock = stockMap.get(post.title) || {};
        const carry = stock.carryOver ?? 0;
        const inout = stock.inOutTotal ?? 0;
        const rate = stock.averageRate ?? 0;
        return [post.title, carry, inout, carry + inout, rate];
      }),
    });

    doc.save(`DailyStock-${selectedBranch}-${today}.pdf`);
  };

  // ฟังก์ชันสำหรับสร้าง PDF รายงานสต๊อกรายวันช่วงวันที่เลือก โดยไม่ใช้ API
  const generateDailyStockPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Daily Stock Report: ${selectedBranch}`, 105, 15, { align: "center" });
    doc.text(`From: ${selectedDateForDailyStock.start} To: ${selectedDateForDailyStock.end}`, 105, 25, { align: "center" });

    autoTable(doc, {
      startY: 35,
      head: [["Currency", "Carry Over", "In/Out", "Total", "Average Rate"]],
      body: currencyTitles.map((post) => {
        const stock = stockMap.get(post.title) || {};
        const carry = stock.carryOver ?? 0;
        const inout = stock.inOutTotal ?? 0;
        const rate = stock.averageRate ?? 0;
        return [post.title, carry, inout, carry + inout, rate];
      }),
    });

    const filename = `DailyStock-${selectedBranch}-${selectedDateForDailyStock.start}_to_${selectedDateForDailyStock.end}.pdf`;
    doc.save(filename);
  };

  // ฟังก์ชันบันทึกข้อมูลสต๊อกทีละรายการ
  const handleSaveStock = async () => {
    const payload = {
      date: today,
      branch: selectedBranch,
      items: calculatedStock.map((stock) => ({
        currency: stock.currency,
        carryOver: stock.carryOver,
        inOutTotal: stock.inOutTotal,
        averageRate: stock.averageRate,
        actual: stock.carryOver + stock.inOutTotal,
        difference: null,
        finalized: false
      })),
      createdBy: session?.user?.name || "unknown"
    };

    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/dailystocks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    console.log("📦 บันทึกข้อมูลแล้ว:", result);
    alert("บันทึกข้อมูลเรียบร้อยแล้ว");
    window.location.href = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/admin`;
  };

  return (
    <div className="flex flex-col min-h-screen">
      <AdminNav session={session} />
      <div className='flex-grow'>
        <div className='container mx-auto'>
          <div className='flex justify-between mt-10'>
            <SideNav />
            <div className="flex-grow border rounded-lg p-4 bg-white shadow-sm mb-6 w-full">
              <div className="flex space-x-4 mt-2 ml-2">
                <select
                  className="px-4 py-2 border rounded bg-white text-gray-700"
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                >
                  <option value="">-- เลือกสาขา --</option>
                  {branches.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
                {!alreadyCalculated && (
                  <button
                    onClick={handleCalculateStock}
                    disabled={!selectedBranch}
                    className={`${
                      selectedBranch ? "bg-blue-500 hover:bg-blue-700" : "bg-gray-400 cursor-not-allowed"
                    } text-white font-bold py-2 px-4 rounded`}
                  >
                    คำนวณสต๊อก
                  </button>
                )}
                <button
                  className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                  onClick={() => {
                    if (!selectedBranch) return;
                    const url = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/userstock?branch=${selectedBranch}`;
                    window.open(url, "_blank");
                  }}
                >
                  ดูสต๊อกปัจจุบัน
                </button>
                <button
                  className="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded"
                  onClick={() => {
                    if (!selectedBranch) return;
                    const url = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/admin/editstock?branch=${selectedBranch}`;
                    window.open(url, "_blank");
                  }}
                >
                  แก้ไขสต๊อก
                </button>
                <div className="flex items-center space-x-2">
                  <input
                    type="date"
                    value={selectedDateForDailyStock.start || ""}
                    onChange={(e) =>
                      setSelectedDateForDailyStock((prev) => ({
                        ...prev,
                        start: e.target.value,
                      }))
                    }
                    className="border rounded px-2 py-1"
                    disabled={!selectedBranch}
                  />
                  <span>ถึง</span>
                  <input
                    type="date"
                    value={selectedDateForDailyStock.end || ""}
                    onChange={(e) =>
                      setSelectedDateForDailyStock((prev) => ({
                        ...prev,
                        end: e.target.value,
                      }))
                    }
                    className="border rounded px-2 py-1"
                    disabled={!selectedBranch}
                  />
                  <button
                    disabled={
                      !selectedBranch ||
                      !selectedDateForDailyStock.start ||
                      !selectedDateForDailyStock.end
                    }
                    className={`${
                      selectedBranch && selectedDateForDailyStock.start && selectedDateForDailyStock.end
                        ? "bg-green-500 hover:bg-green-700"
                        : "bg-gray-400 cursor-not-allowed"
                    } text-white font-bold py-2 px-4 rounded`}
                    onClick={generateDailyStockPDF}
                  >
                    ดูสต๊อกรายวัน
                  </button>
                </div>
              </div>
              {showStockTable && (
                <>
                  <div className="mt-6 mb-4">
                    <button
                      onClick={handleSaveStock}
                      className="bg-purple-600 hover:bg-purple-800 text-white font-bold py-2 px-4 rounded"
                    >
                      บันทึกข้อมูล
                    </button>
                  </div>
                  <div className="mt-4">
                    <table className="min-w-full border border-gray-300 text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="border px-4 py-2">สกุลเงิน</th>
                          <th className="border px-4 py-2">ยอดยกมา</th>
                          <th className="border px-4 py-2">เข้า/ออกวันนี้</th>
                          <th className="border px-4 py-2">รวมทั้งหมด</th>
                          <th className="border px-4 py-2">เรทเฉลี่ย</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currencyTitles.map((post, index) => (
                          <tr key={index}>
                            <td className="border px-4 py-2">{post.title}</td>
                            <td className="border px-4 py-2">
                              {stockMap.get(post.title)?.carryOver ?? 0}
                            </td>
                            <td className="border px-4 py-2">
                              {stockMap.get(post.title)?.inOutTotal ?? 0}
                            </td>
                            <td className="border px-4 py-2">
                              {(stockMap.get(post.title)?.carryOver ?? 0) + (stockMap.get(post.title)?.inOutTotal ?? 0)}
                            </td>
                            <td className="border px-4 py-2">
                              {stockMap.get(post.title)?.averageRate ?? 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <Footer />

    </div>
  )
}

export default AdminPage
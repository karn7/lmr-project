"use client"

import React, { useState, useEffect } from 'react'
import Container from '../components/Container'
import AdminLayout from '../components/AdminLayout'
import AdminNav from '../components/AdminNav'
import Footer from '../components/Footer'
import SideNav from '../components/SideNav'

import { useSession, signOut } from 'next-auth/react'
import { redirect, useRouter } from 'next/navigation'
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function AdminPage() {

    const { data: session } = useSession();
    const router = useRouter();
    
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

      // เพิ่มการดึงค่า rate ของเมื่อวาน (ใช้ /api/dailystocks)
      const dailyStockYRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/dailystocks?branch=${selectedBranch}&date=${yesterdayStr}`);
      const dailyStockYJson = await dailyStockYRes.json();
      const yesterdayStockItems = dailyStockYJson.stocks?.[0]?.items || [];
      const rateYesterdayMap = new Map(yesterdayStockItems.map(item => [item.currency, item.averageRate]));

      // ดึง record ทั้งหมด แล้ว filter หาวันนี้และ payType = "Buying" เพื่อคำนวณ average rate (จาก items)
      const recordRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/record`);
      const recordJson = await recordRes.json();
      const todayItems = (recordJson.records || [])
        .filter((r) => {
          const recordDate = r.date
            ? r.date.split("T")[0]
            : r.createdAt
            ? new Date(r.createdAt).toISOString().split("T")[0]
            : "";
          return r.branch === selectedBranch && r.payType === "Buying" && recordDate === today;
        })
        .flatMap((r) => r.items || []);

      const rateSum = {};
      const rateCount = {};

      todayItems.forEach((item) => {
        if (!rateSum[item.currency]) {
          rateSum[item.currency] = 0;
          rateCount[item.currency] = 0;
        }
        if (item.rate && item.rate > 0) {
          rateSum[item.currency] += item.rate;
          rateCount[item.currency] += 1;
        }
      });

      const rateTodayMap = new Map(
        Object.keys(rateSum).map((currency) => [
          currency,
          rateSum[currency] / rateCount[currency],
        ])
      );

      // map currencyTitles ทั้งหมด และรวมข้อมูล inOutJson.data + averageRate และยอดยกมาจาก carryMap
      const mergedStock = currencyTitles.map(({ title }) => {
        const inOutItem = (inOutJson.data || []).find((i) => i.currency === title);
        const carry = carryMap.get(title) ?? 0;
        const inout = inOutItem?.inOutTotal ?? 0;

        const rateY = rateYesterdayMap.get(title) ?? 0;
        const rateT = rateTodayMap.get(title) ?? 0;

        return {
          currency: title,
          carryOver: carry,
          inOutTotal: inout,
          averageRate: inOutItem
            ? (rateY && rateT ? (rateY + rateT) / 2 : rateY || rateT)
            : rateY || 0
        };
      });
      setCalculatedStock(mergedStock);
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

  // ฟังก์ชันสำหรับสร้าง PDF รายงานสต๊อกรายวันช่วงวันที่เลือก โดยดึงข้อมูลแต่ละวันจริง
  const generateDailyStockPDF = async () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Daily Stock Report: ${selectedBranch}`, 105, 15, { align: "center" });
    doc.text(`From: ${selectedDateForDailyStock.start} To: ${selectedDateForDailyStock.end}`, 105, 25, { align: "center" });

    const startDate = new Date(selectedDateForDailyStock.start);
    const endDate = new Date(selectedDateForDailyStock.end);
    const dateList = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      dateList.push(new Date(d));
    }

    // Reduce font size to fit one full day per page and force each day to start on a new page
    let isFirstPage = true;

    for (const dateObj of dateList) {
      const dateStr = dateObj.toISOString().split("T")[0];

      // Updated API call to use /api/dailystocks and get items from stocks[0]?.items
      const stockRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/dailystocks?branch=${selectedBranch}&date=${dateStr}`);
      const stockJson = await stockRes.json();
      const stockItems = stockJson.stocks[0]?.items || [];
      const stockData = new Map(stockItems.map(item => [item.currency, item]));

      if (!isFirstPage) {
        doc.addPage();
      } else {
        isFirstPage = false;
      }

      let y = 15;
      doc.setFontSize(12);
      doc.text(`Date: ${dateStr}`, 14, y);

      autoTable(doc, {
        startY: y + 5,
        head: [["Currency", "Carry Over", "In/Out", "Total", "Average Rate"]],
        body: currencyTitles.map((post) => {
          const stock = stockData.get(post.title) || {};
          const carry = stock.carryOver ?? 0;
          const inout = stock.inOutTotal ?? 0;
          const rate = stock.averageRate ?? 0;
          return [post.title, carry, inout, carry + inout, rate];
        }),
        styles: { fontSize: 6 },
        margin: { top: y + 5 }
      });
    }

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
    <Container className="min-h-screen flex flex-col">
      <div className="hidden md:block">
        <AdminNav session={session} />
      </div>
      <div className="flex-grow">
        <AdminLayout session={session}>
          <div className="container mx-auto">
            <div className="border rounded-lg p-4 bg-white shadow-sm mb-6 w-full mt-10">
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
        </AdminLayout>
      </div>
      <Footer />
    </Container>
  )
}

export default AdminPage
"use client"

import React, { useState, useEffect } from 'react'
import AdminNav from '../components/AdminNav'
import Footer from '../components/Footer'
import Container from '../components/Container'
import AdminLayout from '../components/AdminLayout'

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

      fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/dailystocks/check?branch=${selectedBranch}&date=${selectedDateForDailyStock.start || today}`)
        .then((res) => res.json())
        .then((data) => {
          setAlreadyCalculated(data.exists);
          // ลบการคำนวณอัตโนมัติ
        });
    }, [selectedBranch, selectedDateForDailyStock.start]);

    const handleCalculateStock = async () => {
      const calculationDate = selectedDateForDailyStock.start || today;
      if (alreadyCalculated) {
        alert("ข้อมูลถูกบันทึกลงสต๊อกแล้ว");
        return;
      }
      // ดึงข้อมูลยอดปิดร้านของเมื่อวาน
      const yesterday = new Date(calculationDate);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      const carryRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/dailystocks/last-close?branch=${selectedBranch}&date=${yesterdayStr}`);
      const carryJson = await carryRes.json();
      const carryMap = new Map((carryJson.items || []).map(item => [item.currency, item.actual]));

      // ดึงเฉพาะข้อมูลจาก /api/stock-diff-today พร้อมเพิ่ม payType = "Buying"
      const inOutRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/stock-diff-today`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch: selectedBranch, date: calculationDate, payType: "Buying" }),
      });
      const inOutJson = await inOutRes.json();

      // ดึง rateY และ rateT จาก summary API แค่ครั้งเดียว
      const summaryRes = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/dailystocks/summary?branch=${selectedBranch}&date=${calculationDate}`
      );
      const { items = [] } = await summaryRes.json();
      const rateYMap = new Map(items.map(i => [i.currency, i.rateY]));
      const rateTMap = new Map(items.map(i => [i.currency, i.rateT]));

      // map currencyTitles ทั้งหมด และรวมข้อมูล inOutJson.data + averageRate และยอดยกมาจาก carryMap
      const mergedStock = currencyTitles.map(({ title }) => {
        const inOutItem = (inOutJson.data || []).find((i) => i.currency === title);
        const carry = carryMap.get(title) ?? 0;
        const buyTotal  = inOutItem?.buyTotal  ?? 0;
        const sellTotal = inOutItem?.sellTotal ?? 0;
        const inout     = inOutItem?.inOutTotal ?? 0;

        const rateY = rateYMap.get(title) ?? 0;
        const rateT = rateTMap.get(title) ?? 0;

        const averageRate = (() => {
          if (!rateY && rateT) return rateT;
          if (!rateT && rateY) return rateY;
          const totalAmount = carry + inout;
          return totalAmount ? ((carry * rateY) + (inout * rateT)) / totalAmount : 0;
        })();

        return {
          currency: title,
          carryOver: carry,
          buyTotal,
          sellTotal,
          inOutTotal: inout,
          averageRate,
        };
      });
      setCalculatedStock(mergedStock);
      console.log("📊 ข้อมูล mergedStock:", mergedStock);
      setShowStockTable(true);
    };

    useEffect(() => {
      if (session && session.user?.role !== "admin") {
        redirect(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/welcome`);
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
    const calculationDate = selectedDateForDailyStock.start || today;
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

    doc.save(`DailyStock-${selectedBranch}-${calculationDate}.pdf`);
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
    const calculationDate = selectedDateForDailyStock.start || today;
    const payload = {
      date: calculationDate,
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
    <Container>
      <div className="hidden md:block">
        <AdminNav session={session} />
      </div>
      <div className="flex-grow">
        <AdminLayout>
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
              <input
                type="date"
                value={selectedDateForDailyStock.start || today}
                onChange={(e) => {
                  const date = new Date(e.target.value);
                  const formatted = date.toISOString().split("T")[0];
                  setSelectedDateForDailyStock((prev) => ({ ...prev, start: formatted }));
                }}
                className="border rounded px-2 py-2"
                disabled={!selectedBranch}
              />
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
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full border border-gray-300 text-xs md:text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="border px-4 py-2">สกุลเงิน</th>
                        <th className="border px-4 py-2">ยอดยกมา</th>
                        <th className="border px-4 py-2">ยอดซื้อ</th>
                        <th className="border px-4 py-2">ยอดขาย</th>
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
                            {stockMap.get(post.title)?.buyTotal ?? 0}
                          </td>
                          <td className="border px-4 py-2">
                            {stockMap.get(post.title)?.sellTotal ?? 0}
                          </td>
                          <td className="border px-4 py-2">
                            {stockMap.get(post.title)?.inOutTotal ?? 0}
                          </td>
                          <td className="border px-4 py-2">
                            {(stockMap.get(post.title)?.carryOver ?? 0) +
                             (stockMap.get(post.title)?.inOutTotal ?? 0)}
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
        </AdminLayout>
      </div>
      <Footer />
    </Container>
  )
}

export default AdminPage
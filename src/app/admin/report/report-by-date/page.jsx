"use client";

import React, { useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

export default function ReportByDate() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [selectedPayType, setSelectedPayType] = useState("Buying");
  const selectedBranch = "Asawann";

  const fetchData = async () => {
    setLoading(true);

    if (!startDate || !endDate) {
      alert("กรุณาเลือกช่วงวันที่ก่อนดึงข้อมูล");
      setLoading(false);
      return;
    }

    const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
    const url =
      selectedPayType === "Selling"
        ? `${base}/api/items-by-date?start=${startDate}&end=${endDate}&branch=${selectedBranch}&payType=Selling,Wholesale`
        : `${base}/api/items-by-date?start=${startDate}&end=${endDate}&branch=${selectedBranch}&payType=${selectedPayType}`;
    console.log("🔍 Loading data for branch:", selectedBranch);
    const res = await fetch(url);

    if (!res.ok) {
      console.error("เกิดข้อผิดพลาดในการโหลดข้อมูล:", res.status);
      setLoading(false);
      return;
    }

    const data = await res.json();
    const filteredRecords = data.records.map(day => ({
      ...day,
      items: day.items.filter(item => item.branch === selectedBranch)
    }));
    setRecords(filteredRecords);
    setLoading(false);
  };

  const generatePDF = async () => {
    const formatNumber = (num) => {
      if (typeof num === "number") {
        return num.toLocaleString("en-US", { maximumFractionDigits: 6 });
      }
      return num;
    };

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Currency Exchange Report", 105, 15, { align: "center" });

    const rateCache = {};

    // Pre-fetch average rates for each day
    if (selectedPayType === "Selling") {
      await Promise.all(
        records.map(async (day) => {
          const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/dailystocks?branch=${selectedBranch}&date=${day.date}`);
          const json = await res.json();
          const stockItems = json.stocks?.[0]?.items || [];
          rateCache[day.date] = Object.fromEntries(
            stockItems.map((item) => [item.currency, item.averageRate ?? 0])
          );
        })
      );
    }

    let grandTotalProfit = 0;
    records.forEach((day, index) => {
      if (index !== 0) {
        doc.addPage();
      }
      let y = 30;
      doc.text(`Date: ${day.date}`, 14, y);
      const headers = selectedPayType === "Selling"
        ? ["Document", "Currency", "Amount", "Rate", "Total", "Cost Rate", "Cost Total", "Profit/Loss"]
        : ["Document", "Currency", "Amount", "Rate", "Total"];

      let totalProfit = 0;
      const body = day.items.map((item) => {
        const base = [
          item.docNumber,
          item.currency,
          formatNumber(item.amount),
          formatNumber(item.rate),
          formatNumber(item.total),
        ];
        if (selectedPayType === "Selling") {
          const costRate = rateCache[day.date]?.[item.currency] ?? 0;
          const costTotal = item.amount * costRate;
          const profit = item.total - costTotal;
          totalProfit += profit;
          base.push(
            formatNumber(costRate),
            formatNumber(costTotal.toFixed(2)),
            formatNumber(profit.toFixed(2))
          );
        }
        return base;
      });

      autoTable(doc, {
        startY: y + 5,
        head: [headers],
        body,
      });
      if (selectedPayType === "Selling") {
        doc.setFontSize(10);
        doc.text(`Total Profit/Loss: ${totalProfit.toFixed(2)}`, 200, doc.lastAutoTable.finalY + 6, { align: "right" });
        doc.setFontSize(12);
        y = doc.lastAutoTable.finalY + 14;
        grandTotalProfit += totalProfit;
      } else {
        y = doc.lastAutoTable.finalY + 10;
      }
    });

    let finalY = doc.lastAutoTable?.finalY ?? 280;

    if (selectedPayType === "Selling") {
      doc.setFontSize(14);
      doc.text(`Grand Total Profit/Loss: ${formatNumber(grandTotalProfit.toFixed(2))}`, 105, finalY + 10, { align: "center" });
    }
    
    const filename = `${selectedPayType}-${startDate}_to_${endDate}.pdf`;
    doc.save(filename);
  };

  const generateExcel = () => {
    const wb = XLSX.utils.book_new();

    records.forEach((day) => {
      const wsData = [
        ["Document", "Currency", "Amount", "Rate", "Total"],
        ...day.items.map((item) => [
          item.docNumber,
          item.currency,
          item.amount,
          item.rate,
          item.total,
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, day.date);
    });

    const filename = `${selectedPayType}-${startDate}_to_${endDate}.xlsx`;
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([wbout], { type: "application/octet-stream" }), filename);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <button onClick={() => window.history.back()} className="mb-4 bg-gray-300 px-4 py-2 rounded">ย้อนกลับ</button>
      <h1 className="text-2xl font-bold">รายงานตามช่วงเวลา</h1>
      <div className="space-x-2">
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        {/* Radio buttons for payType */}
        <label className="mr-4">
          <input
            type="radio"
            name="payType"
            value="Buying"
            checked={selectedPayType === "Buying"}
            onChange={(e) => setSelectedPayType(e.target.value)}
          /> Buying
        </label>
        <label>
          <input
            type="radio"
            name="payType"
            value="Selling"
            checked={selectedPayType === "Selling"}
            onChange={(e) => setSelectedPayType(e.target.value)}
          /> Selling
        </label>
        <button onClick={fetchData} className="bg-blue-600 text-white px-4 py-2 rounded">ดึงข้อมูล</button>
        {records.length > 0 && (
          <>
            <button onClick={generatePDF} className="bg-green-600 text-white px-4 py-2 rounded">ดาวน์โหลด PDF</button>
            <button onClick={generateExcel} className="bg-yellow-600 text-white px-4 py-2 rounded">ดาวน์โหลด Excel</button>
          </>
        )}
      </div>

      {loading && <p>กำลังโหลดข้อมูล...</p>}
      {!loading && records.map((day) => (
        <div key={day.date} className="border p-4 rounded-md mt-4">
          <h2 className="font-semibold">วันที่: {day.date}</h2>
          <ul className="mt-2">
            {day.items.map((item, idx) => (
              <li key={idx} className="text-sm">
                • [{item.docNumber}] {item.currency} - จำนวน {item.amount} ที่เรท {item.rate} รวม {item.total}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
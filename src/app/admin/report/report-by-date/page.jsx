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
  const [editing, setEditing] = useState(false);
  const [draftRates, setDraftRates] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const keyOf = (item) => `${item.recordId}:${item.itemId}`;
  const hasChanges = Object.keys(draftRates).length > 0;
  const changeView = (value) => {
    if (hasChanges && !window.confirm("ยกเลิกเรทที่ยังไม่ได้บันทึก?")) return;
    setSelectedPayType(value);
    setRecords([]);
    setDraftRates({});
    setEditing(false);
  };
  const saveRates = async () => {
    const changes = records.flatMap(day => day.items).filter(item => keyOf(item) in draftRates)
      .map(item => ({ recordId: item.recordId, itemId: item.itemId, expectedRate: item.rate,
        expectedAmount: item.amount, expectedTotal: item.total, expectedDocNumber: item.docNumber,
        rate: Number(draftRates[keyOf(item)]) }));
    if (changes.some(item => !Number.isFinite(item.rate) || item.rate <= 0 || item.rate > 1e8)) {
      setError("กรุณาระบุเรทมากกว่า 0 และไม่เกิน 100,000,000"); return;
    }
    setSaving(true); setError("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/record/rates`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes, branch: selectedBranch })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "บันทึกไม่สำเร็จ");
      setRecords(previous => previous.map(day => ({ ...day, items: day.items.map(item => {
        const updated = data.items.find(change => keyOf(change) === keyOf(item));
        return updated ? { ...item, rate: updated.rate, total: updated.total } : item;
      }) })));
      setDraftRates({}); setEditing(false);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };
  const selectedBranch = "Asawann";

  const fetchData = async (view = selectedPayType) => {
    if (hasChanges && !window.confirm("ยกเลิกเรทที่ยังไม่ได้บันทึกและโหลดข้อมูลใหม่?")) return;
    if (!startDate || !endDate || startDate > endDate) {
      setError("กรุณาเลือกช่วงวันที่ให้ถูกต้อง"); return;
    }
    setLoading(true); setError("");
    try {
      const payType = view === "Both" ? "Buying,Selling,Wholesale" : view === "Selling" ? "Selling,Wholesale" : "Buying";
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/items-by-date?start=${startDate}&end=${endDate}&branch=${selectedBranch}&payType=${payType}`, { cache: "no-store" });
      if (!res.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");
      const data = await res.json();
      setSelectedPayType(view);
      setRecords(data.records);
      setEditing(false); setDraftRates({});
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
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
        ? ["Document", "Type", "Currency", "Amount", "Rate", "Total", "Cost Rate", "Cost Total", "Profit/Loss"]
        : ["Document", "Type", "Currency", "Amount", "Rate", "Total"];

      let totalProfit = 0;
      const body = day.items.map((item) => {
        const base = [
          item.docNumber,
          item.payType,
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
        ["Document", "Type", "Currency", "Amount", "Rate", "Total"],
        ...day.items.map((item) => [
          item.docNumber,
          item.payType,
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
    <div className="p-6 max-w-7xl mx-auto space-y-4">
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
            onChange={(e) => changeView(e.target.value)} disabled={saving || loading}
          /> Buying
        </label>
        <label>
          <input
            type="radio"
            name="payType"
            value="Selling"
            checked={selectedPayType === "Selling"}
            onChange={(e) => changeView(e.target.value)} disabled={saving || loading}
          /> Selling
        </label>
        <button type="button" disabled={saving || loading} onClick={() => startDate && endDate ? fetchData("Both") : changeView("Both")} aria-pressed={selectedPayType === "Both"} className={`px-4 py-2 rounded ${selectedPayType === "Both" ? "bg-purple-700 text-white" : "bg-purple-100"}`}>Buying / Selling คู่กัน</button>
        <button disabled={saving || loading} onClick={() => fetchData()} className="bg-blue-600 text-white px-4 py-2 rounded">ดึงข้อมูล</button>
        {records.length > 0 && !editing && (
          <>
            <button onClick={generatePDF} className="bg-green-600 text-white px-4 py-2 rounded">ดาวน์โหลด PDF</button>
            <button onClick={generateExcel} className="bg-yellow-600 text-white px-4 py-2 rounded">ดาวน์โหลด Excel</button>
          </>
        )}
      </div>

      {error && <p role="alert" className="text-red-700">{error}</p>}
      {records.some(day => day.items.length) && (
        <div className="flex flex-wrap gap-2 items-center">
          {!editing ? <button disabled={loading} onClick={() => setEditing(true)} className="bg-orange-600 text-white px-4 py-2 rounded">แก้ไขอัตราแลกเปลี่ยนทุกรายการ</button> : <>
            <button disabled={saving || !hasChanges} onClick={saveRates} className="bg-green-700 text-white px-4 py-2 rounded disabled:opacity-50">{saving ? "กำลังบันทึก..." : `บันทึกทั้งหมด (${Object.keys(draftRates).length})`}</button>
            <button disabled={saving} onClick={() => { setDraftRates({}); setEditing(false); setError(""); }} className="bg-gray-200 px-4 py-2 rounded">ยกเลิก</button>
            <span className="text-sm">แก้เรทแต่ละแถว ยอดรวมจะคำนวณใหม่เมื่อบันทึก (ไม่ปรับยอดเงินสดของกะ)</span>
          </>}
        </div>
      )}
      {loading && <p>กำลังโหลดข้อมูล...</p>}
      {!loading && records.map(day => (
        <div key={day.date} className="border p-4 rounded-md mt-4">
          <h2 className="font-semibold">วันที่: {day.date}</h2>
          <div className={selectedPayType === "Both" ? "grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2" : "mt-2"}>
            {(selectedPayType === "Both" ? ["Buying", "Selling"] : [selectedPayType]).map(type => (
              <section key={type} className="min-w-0">
                <h3 className="font-semibold mb-2">{type === "Selling" ? "Selling / Wholesale" : "Buying"}</h3>
                <div className="overflow-x-auto"><table className="w-full text-sm">
                  <thead><tr>{["เลขบิล", "สกุลเงิน", "จำนวน", "เรท", "รวม"].map(label => <th key={label} className="p-2 text-left border-b">{label}</th>)}</tr></thead>
                  <tbody>{day.items.filter(item => type === "Buying" ? item.payType === "Buying" : ["Selling", "Wholesale"].includes(item.payType)).map(item => {
                    const key = keyOf(item);
                    const rate = draftRates[key] ?? item.rate;
                    return <tr key={key}>
                      <td className="p-2">{item.docNumber}</td><td className="p-2">{item.currency}</td><td className="p-2">{item.amount.toLocaleString()}</td>
                      <td className="p-2">{editing ? <input aria-label={`เรท ${item.docNumber} ${item.currency} ${item.itemId}`} type="number" min="0" max="100000000" step="any" disabled={saving} value={rate} onChange={e => setDraftRates(previous => {
                        const next = { ...previous };
                        if (e.target.value !== "" && Number(e.target.value) === item.rate) delete next[key];
                        else next[key] = e.target.value;
                        return next;
                      })} className="border rounded p-1 w-28" /> : item.rate}</td>
                      <td className="p-2">{(key in draftRates ? item.amount * Number(rate) : item.total).toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                    </tr>;
                  })}</tbody>
                </table></div>
                {!day.items.some(item => type === "Buying" ? item.payType === "Buying" : ["Selling", "Wholesale"].includes(item.payType)) && <p className="p-2 text-gray-500">ไม่มีรายการ</p>}
              </section>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

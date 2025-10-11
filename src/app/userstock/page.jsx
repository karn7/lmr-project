"use client";

import React, { useEffect, useState, useCallback } from "react";

function StockSummaryPage() {
  const [currencyTitles, setCurrencyTitles] = useState([]);
  const [calculatedStock, setCalculatedStock] = useState([]);
  const [showStockTable, setShowStockTable] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSelectedBranch(params.get("branch") || "");
  }, []);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    fetch("/api/posts")
      .then((res) => res.json())
      .then((data) => {
        const uniqueTitles = [];
        const seen = new Set();
        for (const post of data.posts || []) {
          if (!seen.has(post.title) && post.title !== "THB" && post.title !== "บาท") {
            seen.add(post.title);
            uniqueTitles.push(post);
          }
        }
        setCurrencyTitles(uniqueTitles);
      });
  }, []);

  const fetchAndCalculateStock = useCallback(async () => {
    if (!selectedBranch) return;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    const carryRes = await fetch(`/api/dailystocks/last-close?branch=${selectedBranch}&date=${yesterdayStr}`);
    const carryJson = await carryRes.json();
    const carryMap = new Map((carryJson.items || []).map(item => [item.currency, item.actual]));

    const inOutRes = await fetch(`/api/stock-diff-today`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branch: selectedBranch, date: today }),
    });
    const inOutJson = await inOutRes.json();

    const mergedStock = currencyTitles.map(({ title }) => {
      const inOutItem = (inOutJson.data || []).find((i) => i.currency === title) || {};
      return {
        currency: title,
        carryOver: carryMap.get(title) ?? 0,
        inOutTotal: inOutItem.inOutTotal ?? 0,
      };
    });

    setCalculatedStock(mergedStock);
    setShowStockTable(true);
  }, [selectedBranch, currencyTitles, today]);

  // เรียกครั้งแรก/เมื่อ dependencies เปลี่ยน
  useEffect(() => {
    fetchAndCalculateStock();
  }, [fetchAndCalculateStock]);

  // นับถอยหลังและรีโหลดทุก 30 วินาที
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // รีโหลดข้อมูลแล้วรีเซ็ต
          fetchAndCalculateStock();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [fetchAndCalculateStock]);

  const stockMap = new Map(calculatedStock.map(item => [item.currency, item]));

  return (
    <div className="p-6">
      <div className="fixed top-4 right-4 bg-gray-900 text-white text-xs px-3 py-1 rounded shadow">
        รีโหลดอัตโนมัติใน {countdown}s
      </div>
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="text-xl font-bold">สรุปยอดสต๊อกปัจจุบัน</h1>
        <span className="text-gray-700 text-sm font-medium">
          สาขา: {selectedBranch || "ไม่ได้เลือกสาขา"}
        </span>
      </div>

      {showStockTable && (() => {
        const mid = Math.ceil(currencyTitles.length / 2);
        const leftCurrencies = currencyTitles.slice(0, mid);
        const rightCurrencies = currencyTitles.slice(mid);

        const renderTable = (list) => (
          <table className="w-full border border-gray-300 text-sm mb-4">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-4 py-2">สกุลเงิน</th>
                <th className="border px-4 py-2">รวมทั้งหมด</th>
              </tr>
            </thead>
            <tbody>
              {list.map((post, idx) => {
                const stock = stockMap.get(post.title) || {};
                const total = (stock.carryOver ?? 0) + (stock.inOutTotal ?? 0);
                return (
                  <tr key={idx}>
                    <td
                      className={`border px-4 py-2 ${
                        total < 0 ? "bg-red-100 text-red-700 border-red-400 blink" : ""
                      }`}
                      title={total < 0 ? "ยอดรวมติดลบ" : undefined}
                    >
                      {post.title}
                    </td>
                    <td
                      className={`border px-4 py-2 text-right ${
                        total < 0 ? "bg-red-100 text-red-700 border-red-400 blink" : ""
                      }`}
                      title={total < 0 ? "ยอดรวมติดลบ" : undefined}
                    >
                      {Number(total).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        );

        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>{renderTable(leftCurrencies)}</div>
            <div>{renderTable(rightCurrencies)}</div>
          </div>
        );
      })()}
      <style jsx global>{`
        @keyframes blink {
          0% { opacity: 1; }
          50% { opacity: 0.45; }
          100% { opacity: 1; }
        }
        .blink { animation: blink 1s step-start infinite; }
      `}</style>
    </div>
  );
}

export default StockSummaryPage;

export const dynamic = "force-dynamic";
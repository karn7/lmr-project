"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function StockSummaryPage() {
  const [currencyTitles, setCurrencyTitles] = useState([]);
  const [calculatedStock, setCalculatedStock] = useState([]);
  const [showStockTable, setShowStockTable] = useState(false);

  const searchParams = useSearchParams();
  const selectedBranch = searchParams.get("branch") || "";

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

  useEffect(() => {
    if (!selectedBranch) return;

    const handleCalculateStock = async () => {
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
    };

    handleCalculateStock();
  }, [selectedBranch, currencyTitles]);

  const stockMap = new Map(calculatedStock.map(item => [item.currency, item]));

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">สรุปยอดสต๊อกปัจจุบัน</h1>
      <p className="mb-4 text-gray-700 font-medium">สาขา: {selectedBranch || "ไม่ได้เลือกสาขา"}</p>

      {showStockTable && (
        <table className="min-w-full border border-gray-300 text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-4 py-2">สกุลเงิน</th>
              <th className="border px-4 py-2">รวมทั้งหมด</th>
            </tr>
          </thead>
          <tbody>
            {currencyTitles.map((post, idx) => {
              const stock = stockMap.get(post.title) || {};
              const total = (stock.carryOver ?? 0) + (stock.inOutTotal ?? 0);
              return (
                <tr key={idx}>
                  <td className="border px-4 py-2">{post.title}</td>
                  <td className="border px-4 py-2">{total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default StockSummaryPage;
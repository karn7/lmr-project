"use client";

import React, { useEffect, useState } from "react";

const CashTodayPage = () => {
  const [branchBalances, setBranchBalances] = useState([]);
  const [totalBalance, setTotalBalance] = useState({});
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);

  const formatCurrency = (amount) => {
    const formatted = amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return formatted.endsWith(".00")
      ? formatted.slice(0, -3) + ".-"
      : formatted;
  };

  const fetchAllTodayBalances = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/shifts`,
        { cache: "no-store" }
      );
      const data = await res.json();
      const allShifts = data.shifts || [];

      const balances = allShifts.filter(s => s.date === today);
      setBranchBalances(balances);
      setAllEmployees(balances.map((b) => `${b.employee}#${b.branch}`));
      setSelectedEmployees(balances.map((b) => `${b.employee}#${b.branch}`));
    } catch (err) {
      console.error("Error fetching cash balances today", err);
    }
  };

  useEffect(() => {
    fetchAllTodayBalances();
  }, []);

  useEffect(() => {
    const totalsByCurrency = {};
    branchBalances
      .filter(branch => selectedEmployees.includes(`${branch.employee}#${branch.branch}`))
      .forEach(branch => {
        const cash = branch.cashBalance || {};
        Object.entries(cash).forEach(([currency, amount]) => {
          if (!totalsByCurrency[currency]) totalsByCurrency[currency] = 0;
          totalsByCurrency[currency] += Number(amount) || 0;
        });
      });
    setTotalBalance(totalsByCurrency);
  }, [selectedEmployees, branchBalances]);

  return (
    <div className="p-6 bg-white min-h-screen">
      <div className="mb-4">
        <label className="block font-medium mb-1">เลือกพนักงานที่ต้องการแสดง:</label>
        <div className="flex flex-wrap flex-row gap-x-4 gap-y-1 max-w-4xl">
          {allEmployees.map((empBranchKey) => {
            const [employee, branch] = empBranchKey.split("#");
            return (
              <label key={empBranchKey} className="inline-flex items-center">
                <input
                  type="checkbox"
                  checked={selectedEmployees.includes(empBranchKey)}
                  onChange={(e) => {
                    const updated = e.target.checked
                      ? [...selectedEmployees, empBranchKey]
                      : selectedEmployees.filter((emp) => emp !== empBranchKey);
                    setSelectedEmployees(updated);
                  }}
                  className="mr-2"
                />
                {employee} ({branch})
              </label>
            );
          })}
        </div>
      </div>
      <h1 className="text-xl font-bold mb-4">ยอดเงินรวมทั้งหมดของวันนี้</h1>
      <div className="mb-4 text-sm text-gray-800">
        {Object.keys(totalBalance).length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-2">
            {Object.entries(totalBalance).map(([currency, amount]) => (
              <div key={currency} className={amount < 0 ? "text-red-600" : ""}>
                <span className="font-medium">{currency}:</span>{" "}
                {formatCurrency(amount)}
              </div>
            ))}
          </div>
        ) : (
          <p>ยังไม่มีข้อมูล</p>
        )}
      </div>
      {branchBalances
        .filter(
          (branch) =>
            selectedEmployees.includes(`${branch.employee}#${branch.branch}`)
        )
        .map((branch, idx) => (
          <div
            key={idx}
            className="border border-gray-300 p-4 rounded mb-4 shadow-sm"
          >
            <h3 className="font-semibold mb-1">สาขา: {branch.branch}</h3>
            <p className="text-sm">พนักงาน: {branch.employee}</p>
            <p className="text-sm mb-2">วันที่: {branch.date}</p>
            <ul className="list-disc list-inside text-sm">
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
          </div>
        ))}
    </div>
  );
};

export default CashTodayPage;
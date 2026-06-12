"use client";

import React, { useEffect, useState } from "react";

const CashTodayPage = () => {
  const [branchBalances, setBranchBalances] = useState([]);
  const [totalBalance, setTotalBalance] = useState({});
  const [rates, setRates] = useState({});
  const [totalThbValue, setTotalThbValue] = useState(0);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [bankBalances, setBankBalances] = useState({});
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

  const normalizeCurrency = (value) => String(value || "").trim().toUpperCase();

  const bankCurrencyOptions = ["THB", "LAK", "USD", "CNY"];

  const fetchRates = async () => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/posts`,
        { cache: "no-store" }
      );
      const data = await res.json();
      const posts = data.posts || [];

      const rateMap = {};
      posts.forEach((post) => {
        const currency = normalizeCurrency(post.title || post.content);
        const buyRate = Number(post.buy);
        if (currency && Number.isFinite(buyRate)) {
          rateMap[currency] = buyRate;
        }
      });

      rateMap.THB = 1;
      setRates(rateMap);
    } catch (err) {
      console.error("Error fetching exchange rates", err);
    }
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
    fetchRates();
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

    Object.entries(bankBalances).forEach(([currency, amount]) => {
      const numericAmount = Number(amount) || 0;
      if (numericAmount === 0) return;
      if (!totalsByCurrency[currency]) totalsByCurrency[currency] = 0;
      totalsByCurrency[currency] += numericAmount;
    });

    const totalInThb = Object.entries(totalsByCurrency).reduce(
      (sum, [currency, amount]) => {
        const cur = normalizeCurrency(currency);
        if (cur === "THB") return sum + amount;

        const rate = Number(rates[cur]);
        if (!Number.isFinite(rate)) return sum;

        return sum + amount * rate;
      },
      0
    );

    setTotalBalance(totalsByCurrency);
    setTotalThbValue(totalInThb);
  }, [selectedEmployees, branchBalances, rates, bankBalances]);

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

        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="mb-2 font-medium">ธนาคารเงิน:</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {bankCurrencyOptions.map((currency) => {
              const isChecked = Object.prototype.hasOwnProperty.call(
                bankBalances,
                currency
              );

              return (
                <div key={currency} className="rounded border border-gray-200 bg-white p-3">
                  <label className="inline-flex items-center font-medium">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        setBankBalances((prev) => {
                          if (e.target.checked) {
                            return { ...prev, [currency]: prev[currency] || "" };
                          }

                          const updated = { ...prev };
                          delete updated[currency];
                          return updated;
                        });
                      }}
                      className="mr-2"
                    />
                    ธนาคารเงิน {currency}
                  </label>

                  {isChecked && (
                    <input
                      type="number"
                      value={bankBalances[currency]}
                      onChange={(e) => {
                        const value = e.target.value;
                        setBankBalances((prev) => ({
                          ...prev,
                          [currency]: value,
                        }));
                      }}
                      placeholder={`ยอด ${currency}`}
                      className="mt-2 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <h1 className="text-xl font-bold mb-4">ยอดเงินรวมทั้งหมดของวันนี้</h1>
      <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-green-900 shadow-sm">
        <div className="text-sm font-medium">ยอดรวมตีเป็นเงินบาท</div>
        <div className="text-2xl font-bold">THB {formatCurrency(totalThbValue)}</div>
        <div className="mt-1 text-xs text-green-700">
          THB ใช้ยอดเงินจริง ส่วนสกุลอื่นคำนวณจากเรทซื้อ (buy)
        </div>
      </div>
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
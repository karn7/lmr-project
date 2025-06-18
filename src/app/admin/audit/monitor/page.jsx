"use client";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useEffect } from "react";
import { redirect } from "next/navigation";

export default function MonitorPage() {
  const [activeTab, setActiveTab] = useState("overview");

  const { data: session, status } = useSession();

  // --- New logic for cash total by currency (all branches, today) ---
  const [branchBalances, setBranchBalances] = useState([]);
  const [totalBalance, setTotalBalance] = useState({});
  const [previousTotal, setPreviousTotal] = useState({});
  const [balanceChanges, setBalanceChanges] = useState({});

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
    } catch (err) {
      console.error("Error fetching cash balances today", err);
    }
  };

  useEffect(() => {
    fetchAllTodayBalances();
  }, []);

  useEffect(() => {
    const totalsByCurrency = {};
    branchBalances.forEach(branch => {
      const cash = branch.cashBalance || {};
      Object.entries(cash).forEach(([currency, amount]) => {
        if (!totalsByCurrency[currency]) totalsByCurrency[currency] = 0;
        totalsByCurrency[currency] += Number(amount) || 0;
      });
    });

    const changes = {};
    Object.entries(totalsByCurrency).forEach(([currency, amount]) => {
      const prev = previousTotal[currency] || 0;
      const diff = amount - prev;
      if (diff !== 0) {
        changes[currency] = diff;
      }
    });

    setPreviousTotal(totalsByCurrency);
    setBalanceChanges(changes);
    setTotalBalance(totalsByCurrency);
  }, [branchBalances]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchAllTodayBalances();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (status === "loading") return; // รอให้ session โหลดเสร็จก่อน
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
  }, [session, status]);

  return (
    <div className="bg-gray-900 min-h-screen text-white p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">มอนิเตอร์ข้อมูลแบบเรียลไทม์</h1>
        <div className="flex space-x-4">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 rounded ${activeTab === "overview" ? "bg-blue-600" : "bg-gray-700"}`}
          >
            ภาพรวม
          </button>
          <button
            onClick={() => setActiveTab("branch")}
            className={`px-4 py-2 rounded ${activeTab === "branch" ? "bg-blue-600" : "bg-gray-700"}`}
          >
            เงินตามสาขา
          </button>
        </div>
      </div>

      {activeTab === "overview" && (
        <div className="space-y-4">
          {/* ยอดเงินสดคงเหลือ */}
          <div className="bg-[#1f2937] rounded-lg p-4 shadow text-white text-center h-[30vh] overflow-y-auto">
            <h2 className="text-xs font-bold mb-4">ยอดรวมเงินวันนี้ (รวมทุกสาขา)</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-2 text-sm">
              {Object.entries(totalBalance || {}).map(([currency, amount]) => {
                const change = balanceChanges[currency];
                return (
                  <div key={currency} className={amount < 0 ? "text-red-400" : ""}>
                    <span className="font-medium">{currency}:</span>{" "}
                    {formatCurrency(amount)}
                    {change !== undefined && change !== 0 && (
                      <span className={change > 0 ? "text-green-400" : "text-red-400"}> ({change > 0 ? "+" : ""}{formatCurrency(change)})</span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-4">
              <button
                onClick={() => router.push("/admin/cash")}
                className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                ดูรายละเอียด
              </button>
            </div>
          </div>

          {/* รายการธุรกรรม & แจ้งเตือน */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 bg-[#1f2937] rounded-lg p-4 shadow text-[#67e8f9] text-xl font-semibold text-center h-[25vh]">
              รายการธุรกรรมล่าสุด
            </div>
            <div className="flex-1 bg-[#1f2937] rounded-lg p-4 shadow text-[#fde68a] text-xl font-semibold text-center h-[25vh]">
              แจ้งเตือน
            </div>
          </div>

          {/* ค่าธรรมเนียม, จำนวนบิล, Log, ผู้ใช้งาน */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#1f2937] rounded-lg p-4 shadow text-[#d8b4fe] text-lg text-center h-[30vh]">
              ค่าธรรมเนียม
            </div>
            <div className="bg-[#1f2937] rounded-lg p-4 shadow text-[#d8b4fe] text-lg text-center h-[30vh]">
              จำนวนบิลปัจจุบัน
            </div>
            <div className="bg-[#1f2937] rounded-lg p-4 shadow text-[#d8b4fe] text-lg text-center h-[30vh]">
              Log เงิน
            </div>
            <div className="bg-[#1f2937] rounded-lg p-4 shadow text-[#d8b4fe] text-lg text-center h-[30vh]">
              ผู้ใช้งาน
            </div>
          </div>
        </div>
      )}

      {activeTab === "branch" && (
        <div className="space-y-4">
          <div className="bg-[#1f2937] p-4 rounded shadow">[แสดงข้อมูลเงินตามสาขา - กราฟและสรุป]</div>
        </div>
      )}
    </div>
  );
}

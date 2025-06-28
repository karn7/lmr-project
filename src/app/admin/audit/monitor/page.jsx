"use client";
import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { redirect, useRouter } from "next/navigation";

export default function MonitorPage() {
  const [activeTab, setActiveTab] = useState("overview");

  // --- Modal popup state for shift chat ---
  const [chatModalOpen, setChatModalOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState(null);
  const [chatMessage, setChatMessage] = useState("");

  const { data: session, status } = useSession();

  // --- New logic for cash total by currency (all branches, today) ---
  const [branchBalances, setBranchBalances] = useState([]);
  const [totalBalance, setTotalBalance] = useState({});
  const [previousTotal, setPreviousTotal] = useState({});
  const [balanceChanges, setBalanceChanges] = useState({});

  const [countdown, setCountdown] = useState(20);

  const [recentRecords, setRecentRecords] = useState([]);
  const shownDocNumbers = useRef(new Set());

  const [cashDrawerLogs, setCashDrawerLogs] = useState([]);

  const [openShiftInfo, setOpenShiftInfo] = useState(null);

  const [todayBills, setTodayBills] = useState({ total: 0, byBranch: {} });

  const [adjustmentLogs, setAdjustmentLogs] = useState([]);

  // --- Notification state ---
  const [notifications, setNotifications] = useState([]);
  // --- Fetch notifications ---
  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/Notification`, {
        cache: "no-store"
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  };

  const fetchTodayBills = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/dashboard/7days`, {
        cache: "no-store",
      });
      const data = await res.json();
      const today = new Date().toISOString().split("T")[0];

      const todayData = Array.isArray(data.data) ? data.data.find((d) => d.date === today) : null;
      if (todayData) {
        const byBranch = {};
        Object.entries(todayData.branches).forEach(([branch, count]) => {
          byBranch[branch] = count;
        });
        setTodayBills({ total: todayData.total, byBranch });
      }
    } catch (err) {
      console.error("Error fetching today bill count:", err);
    }
  };

  const fetchRecentRecords = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/record`, {
        cache: "no-store"
      });
      const data = await res.json();

      const today = new Date().toLocaleDateString("th-TH");
      const todayRecords = data.records.filter(rec => {
        const recordDate = new Date(rec.createdAt).toLocaleDateString("th-TH");
        return recordDate === today;
      });

      const updatedRecords = todayRecords.slice(0, 10).map((rec) => ({
        ...rec,
        isNew: !shownDocNumbers.current.has(rec.docNumber)
      }));

      // Update the shownDocNumbers set
      updatedRecords.forEach((rec) => shownDocNumbers.current.add(rec.docNumber));

      setRecentRecords(updatedRecords);
    } catch (err) {
      console.error("Error fetching recent records:", err);
    }
  };

  const fetchCashDrawerLogs = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/cashdrawer`, {
        cache: "no-store"
      });
      const data = await res.json();
      const today = new Date().toISOString().split("T")[0];
      const todayLogs = data.entries
        .filter((entry) => entry.date === today)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 10);
      setCashDrawerLogs(todayLogs);
    } catch (error) {
      console.error("Error fetching cash drawer logs:", error);
    }
  };

  const fetchOpenShift = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/shifts`, {
        cache: "no-store"
      });
      const data = await res.json();
      const allShifts = data.shifts || [];
      const openShifts = allShifts.filter(
        (s) => s.date === today && !s.closedAt
      );
      setOpenShiftInfo(openShifts);
    } catch (err) {
      console.error("Error fetching open shift info:", err);
    }
  };

  const fetchAdjustmentLogs = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/AdjustmentLog?date=${today}`, {
        cache: "no-store"
      });
      const data = await res.json();
      setAdjustmentLogs(data.logs || []);
    } catch (err) {
      console.error("Error fetching adjustment logs:", err);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 20 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

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
    fetchRecentRecords();
    fetchCashDrawerLogs();
    fetchOpenShift();
    fetchTodayBills();
    fetchAdjustmentLogs();
    fetchNotifications();
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
    fetchRecentRecords();
    fetchCashDrawerLogs();
    fetchAdjustmentLogs();
    fetchNotifications();
    fetchTodayBills(); // ✅ เพิ่มการอัปเดตจำนวนบิลวันนี้
  }, 20000);
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

  // --- Function to send message to shift ---
  const sendShiftMessage = async () => {
    if (!chatMessage || !selectedShift) return;
    try {
      // The following line is intentionally left as a placeholder for shiftId construction:
      // const shiftId = encodeURIComponent(`${session?.user?.branch}_${session?.user?.name}_${today}`);
      const shiftId = encodeURIComponent(session?.user?.name || "");
      await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/shiftchat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shiftId: selectedShift._id,
          message: chatMessage,
          sender: session?.user?.name,
          employee: selectedShift.employee,
          branch: selectedShift.branch,
          date: selectedShift.date || new Date(selectedShift.createdAt).toISOString().split("T")[0],
          createdBy: session?.user?.name,
        }),
      });
      alert("ส่งข้อความสำเร็จ");
      setChatMessage("");
      setChatModalOpen(false);
    } catch (err) {
      console.error("Error sending shift chat:", err);
    }
  };

  return (
    <div className="bg-gray-900 min-h-screen text-white p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">มอนิเตอร์ข้อมูลแบบเรียลไทม์</h1>
        <div className="relative w-6 h-6 mr-2">
          <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
            <path
              d="M18 2.0845
                a 15.9155 15.9155 0 0 1 0 31.831
                a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="#4ade80"
              strokeWidth="3"
              strokeDasharray={`${(countdown / 20) * 100}, 100`}
            />
          </svg>
        </div>
        <div className="flex space-x-4">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 rounded ${activeTab === "overview" ? "bg-blue-600" : "bg-gray-700"}`}
          >
            ภาพรวม
          </button>
          <button
            onClick={() => window.open("/admin/cashtoday", "_blank")}
            className={`px-4 py-2 rounded ${activeTab === "branch" ? "bg-blue-600" : "bg-gray-700"}`}
          >
            เงินตามสาขา
          </button>
          <button
            onClick={() => window.open("/admin/audit/chat", "_blank")}
            className={`px-4 py-2 rounded ${activeTab === "branch" ? "bg-blue-600" : "bg-gray-700"}`}
          >
            สนทนา
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
            <div className="flex-1 bg-[#1f2937] rounded-lg p-4 shadow text-[#67e8f9] h-[25vh] overflow-y-auto text-sm">
              <h3 className="font-semibold text-base mb-2">รายการธุรกรรมล่าสุด</h3>
              <ul className="space-y-1">
                {recentRecords.length > 0 ? recentRecords.map((rec) => (
                  <li
                    key={rec.docNumber}
                    className={`hover:bg-gray-700 p-2 rounded cursor-pointer ${rec.isNew ? "bg-yellow-700/40 font-semibold" : ""}`}
                    onClick={() => window.open(`/admin/report/daily/dailylist/${rec.docNumber}`, "_blank")}
                  >
                    <div className="flex justify-between">
                      <span>{rec.payType}</span>
                      <span className={rec.total < 0 ? "text-red-400" : "text-green-400"}>
                        {(rec.total ?? 0).toLocaleString()} {rec.currency}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 flex justify-between">
                      <span>{rec.employee}</span>
                      <span>{new Date(rec.createdAt).toLocaleTimeString("th-TH", { hour12: false })}</span>
                    </div>
                  </li>
                )) : (
                  <li className="text-gray-400 text-center">ไม่มีข้อมูล</li>
                )}
              </ul>
            </div>
            <div className="flex-1 bg-[#1f2937] rounded-lg p-4 shadow text-[#fde68a] text-sm overflow-y-auto h-[25vh]">
              <h3 className="font-semibold text-base mb-2 text-center">แจ้งเตือน</h3>
              <ul className="space-y-2">
                {notifications.length > 0 ? notifications.slice(0, 15).map((note, idx) =>
                  note.status !== "resolved" && (
                    <li
                      key={idx}
                      className={`p-2 rounded hover:bg-gray-700 transition-all duration-200 cursor-pointer ${note.status === "unread" ? "bg-yellow-700/30" : "bg-gray-800"}`}
                      onClick={async () => {
                        try {
                          await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/Notification`, {
                            method: "PATCH",
                            headers: {
                              "Content-Type": "application/json",
                            },
                            body: JSON.stringify({ id: note._id, action: "read" }),
                          });
                          setNotifications(prev =>
                            prev.map(n =>
                              n._id === note._id ? { ...n, status: "read" } : n
                            )
                          );
                        } catch (err) {
                          console.error("Error updating notification status:", err);
                        }
                      }}
                    >
                      <details>
                        <summary>{note.message}</summary>
                        <div className="text-gray-300 text-xs mt-1 space-y-1">
                          <div><strong>Doc:</strong> {note.docNumber || "-"}</div>
                          <div><strong>พนักงาน:</strong> {note.employee || "-"}</div>
                          <div><strong>ประเภท:</strong> {note.type || "-"}</div>
                          <div><strong>รายละเอียด:</strong> {JSON.stringify(note.details || {}, null, 2)}</div>
                          <div><strong>เวลา:</strong> {new Date(note.createdAt).toLocaleTimeString("th-TH", { hour12: false })}</div>
                        </div>
                        {note.docNumber && (
                          <div className="mt-2 text-right">
                            <button
                              className="text-sm text-blue-400 hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(`/admin/report/daily/dailylist/${note.docNumber}`, "_blank");
                              }}
                            >
                              ไปยังรายการ
                            </button>
                          </div>
                        )}
                      </details>
                      {note.status !== "resolved" ? (
                        <div className="mt-2 flex justify-between items-center text-xs">
                          <span className="text-yellow-400">รอดำเนินการแก้ไข</span>
                          <button
                            className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs"
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/Notification`, {
                                  method: "PATCH",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({ id: note._id, action: "resolve" }),
                                });
                                if (res.ok) {
                                  setNotifications(prev =>
                                    prev.map(n =>
                                      n._id === note._id ? { ...n, status: "resolved" } : n
                                    )
                                  );
                                }
                              } catch (err) {
                                console.error("Error updating to resolved:", err);
                              }
                            }}
                          >
                            เสร็จสิ้น
                          </button>
                        </div>
                      ) : null}
                    </li>
                  )
                ) : (
                  <li className="text-center text-gray-400">ไม่มีการแจ้งเตือน</li>
                )}
              </ul>
            </div>
          </div>

          {/* ค่าธรรมเนียม, จำนวนบิล, Log, ผู้ใช้งาน */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#1f2937] rounded-lg p-4 shadow text-[#d8b4fe] text-sm overflow-y-auto h-[30vh]">
              <h3 className="font-semibold text-base mb-2 text-center">การเอาเงินเข้าออกของพนักงาน</h3>
              <ul className="space-y-1">
                {cashDrawerLogs.length > 0 ? cashDrawerLogs.map((log, index) => (
                  <li
                    key={index}
                    className="flex justify-between text-white relative group"
                  >
                    <span>{log.user}</span>
                    <span className={log.type === "in" ? "text-green-400" : "text-red-400"}>
                      {log.type === "in" ? "+" : "-"}
                      {formatCurrency(log.amount)} {log.currency}
                    </span>
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 text-xs text-black bg-yellow-100 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                      {log.reason ? log.reason : "ไม่ระบุเหตุผล"}
                    </div>
                  </li>
                )) : (
                  <li className="text-gray-400 text-center">ไม่มีข้อมูล</li>
                )}
              </ul>
            </div>
            <div className="bg-[#1f2937] rounded-lg p-4 shadow text-[#d8b4fe] text-sm h-[30vh] overflow-y-auto">
              <h3 className="font-semibold text-base mb-2 text-center">จำนวนบิลวันนี้</h3>
              <div className="text-center text-3xl text-white font-bold mb-2">{todayBills.total}</div>
              <ul className="space-y-1 text-sm">
                {Object.entries(todayBills.byBranch).map(([branch, count]) => (
                  <li key={branch} className="flex justify-between text-white px-4">
                    <span>{branch}</span>
                    <span>{count}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-[#1f2937] rounded-lg p-4 shadow text-[#d8b4fe] text-sm overflow-y-auto h-[30vh]">
              <h3 className="font-semibold text-base mb-2 text-center">Log เงิน</h3>
              <ul className="space-y-2 text-white text-xs">
                {adjustmentLogs.length > 0 ? (
                  Object.entries(
                    adjustmentLogs.slice(0, 15).reduce((acc, log) => {
                      const doc = log.docNumber || `__no_doc_${Math.random()}`;
                      if (!acc[doc]) acc[doc] = [];
                      acc[doc].push(log);
                      return acc;
                    }, {})
                  ).map(([docNumber, logs], i) => (
                    <li key={i} className="border border-gray-600 rounded p-2 space-y-1">
                      {logs.map((log, idx) => (
                        <div
                          key={idx}
                          className={`flex justify-between ${log.action === "increase" ? "text-green-600" : "text-red-600"}`}
                        >
                          <span>{log.employee || "ไม่ระบุผู้ใช้"}</span>
                          <span>
                            {log.action === "increase" ? "+" : "-"}
                            {Math.abs(log.amount)?.toLocaleString()} {log.currency}
                          </span>
                        </div>
                      ))}
                    </li>
                  ))
                ) : (
                  <li className="text-gray-400 text-center">ไม่มีข้อมูล</li>
                )}
              </ul>
            </div>
            <div className="bg-[#1f2937] rounded-lg p-4 shadow text-[#d8b4fe] text-sm overflow-y-auto h-[30vh]">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold text-base">กะที่เปิดอยู่</h3>
                <button
                  onClick={fetchOpenShift}
                  className="text-xs bg-gray-700 px-2 py-1 rounded hover:bg-gray-600"
                >
                  รีข้อมูล
                </button>
              </div>
              {openShiftInfo?.length > 0 ? (
                <ul className="space-y-1 text-white text-xs">
                  {openShiftInfo.map((shift, idx) => (
                    <li
                      key={idx}
                      className="border-b border-gray-600 pb-1 mb-1 cursor-pointer hover:bg-gray-700"
                      onClick={() => {
                        setSelectedShift(shift);
                        setChatModalOpen(true);
                      }}
                    >
                      <div className="flex justify-between">
                        <span>พนักงาน: {shift.employee}</span>
                        <span>สาขา: {shift.branch}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>รอบที่: {shift.shiftNo}</span>
                        <span>เวลาเปิด: {new Date(shift.createdAt).toLocaleTimeString("th-TH", { hour12: false })}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-center text-gray-400">ไม่มีข้อมูลกะที่เปิด</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "branch" && (
        <div className="space-y-4">
          <div className="bg-[#1f2937] p-4 rounded shadow">[แสดงข้อมูลเงินตามสาขา - กราฟและสรุป]</div>
        </div>
      )}
      {/* Modal popup for sending message to shift */}
      {chatModalOpen && selectedShift && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white text-black rounded p-4 w-96 shadow-lg">
            <h2 className="text-lg font-bold mb-2">ส่งข้อความถึง {selectedShift.employee}</h2>
            <p className="text-sm mb-2">สาขา: {selectedShift.branch} | รอบ: {selectedShift.shiftNo}</p>
            <textarea
              rows="4"
              className="w-full border border-gray-300 p-2 mb-3"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              placeholder="พิมพ์ข้อความที่ต้องการส่ง..."
            />
            <div className="flex justify-end space-x-2">
              <button className="bg-gray-400 text-white px-3 py-1 rounded" onClick={() => setChatModalOpen(false)}>ยกเลิก</button>
              <button className="bg-blue-600 text-white px-3 py-1 rounded" onClick={sendShiftMessage}>ส่ง</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

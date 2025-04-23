"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function CloseShiftPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [cashBalance, setCashBalance] = useState({});
  const [closeAmount, setCloseAmount] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [summary, setSummary] = useState(null);
  const [shiftInfo, setShiftInfo] = useState(null);

  useEffect(() => {
    const fetchShift = async () => {
      try {
        const res = await fetch(`/api/open-shift/check?employee=${session?.user?.name}`);
        const data = await res.json();
        if (data.open) {
          if (data.cashBalance) {
            setCashBalance(data.cashBalance);
            const initialClose = {};
            for (const currency in data.cashBalance) {
              initialClose[currency] = "";
            }
            setCloseAmount(initialClose);
          }
          setShiftInfo({
            date: data.date ?? "-",
            employee: session?.user?.name ?? "-",
            branch: data.branch ?? "-",
            shiftNo: data.shiftNo ?? "-"
          });
        } else {
          setError("ไม่พบข้อมูลการเปิดร้าน หรือร้านถูกปิดแล้ว");
        }
        setLoading(false);
      } catch (err) {
        console.error("Error fetching shift info:", err);
        setError("เกิดข้อผิดพลาดในการโหลดข้อมูล");
        setLoading(false);
      }
    };

    fetchShift();
  }, []);

  const handleChange = (currency, value) => {
    setCloseAmount((prev) => ({
      ...prev,
      [currency]: value,
    }));
  };

  const confirmCloseShift = async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const resCheck = await fetch(`/api/open-shift/check?employee=${session?.user?.name}`);
      const dataCheck = await resCheck.json();

      if (!dataCheck.shiftNo) {
        alert("ไม่พบข้อมูลการเปิดร้าน");
        return;
      }

      const res = await fetch("/api/closeshift", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          closeAmount,
          shiftNo: dataCheck.shiftNo,
          date: today,
          employee: session?.user?.name
        }),
      });

      if (res.ok) {
        alert("ปิดร้านเรียบร้อยแล้ว");
        setSummary({
          cashBalance: dataCheck.cashBalance,
          closeAmount,
        });
      } else {
        const data = await res.json();
        alert(data.message || "เกิดข้อผิดพลาดในการปิดร้าน");
      }
    } catch (err) {
      console.error("Error closing shift:", err);
      alert("เกิดข้อผิดพลาดในการส่งข้อมูล");
    }
  };

  if (loading) return <div className="p-6">กำลังโหลดข้อมูล...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded shadow">
      {shiftInfo && (
        <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 rounded">
          <p className="text-sm font-medium">
            กำลังจะปิดร้านของวันที่: <strong>{shiftInfo.date}</strong>, พนักงาน: <strong>{shiftInfo.employee}</strong>, 
            สาขา: <strong>{shiftInfo.branch}</strong>, รอบที่: <strong>{shiftInfo.shiftNo}</strong>
          </p>
        </div>
      )}
      <h1 className="text-xl font-bold mb-4">ปิดร้าน</h1>
      <p className="mb-2">กรอกยอดปิดร้านตามสกุลเงินที่มีอยู่</p>
      <form onSubmit={(e) => e.preventDefault()}>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {Object.keys(cashBalance).map((currency) => (
            <div key={currency}>
              <label className="block font-medium mb-1">{currency}:</label>
              <input
                type="text"
                value={
                  closeAmount[currency]
                    ? closeAmount[currency].toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                    : ""
                }
                onChange={(e) => {
                  const raw = e.target.value.replace(/,/g, "");
                  if (!isNaN(raw)) handleChange(currency, raw);
                }}
                className="w-full border px-3 py-2 rounded"
                placeholder={`ยอดปิดร้าน (${currency})`}
              />
            </div>
          ))}
        </div>
      </form>
      <button
        onClick={() => setShowConfirm(true)}
        className="mt-6 bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700"
      >
        ปิดร้าน
      </button>
      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">ยืนยันการปิดร้าน</h2>
            <p className="mb-4">ตรวจสอบยอดที่กรอก:</p>
            <ul className="mb-4">
              {Object.entries(closeAmount).map(([cur, val]) => (
                <li key={cur}>{cur}: {Number(val).toLocaleString()}</li>
              ))}
            </ul>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setShowConfirm(false)}
                className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmCloseShift}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                ยืนยันการปิดร้าน
              </button>
            </div>
          </div>
        </div>
      )}
      {summary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-full max-w-xl">
            <h2 className="text-lg font-bold mb-4">สรุปการปิดร้าน</h2>
            <table className="w-full mb-4 border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border px-4 py-2 text-left">สกุลเงิน</th>
                  <th className="border px-4 py-2 text-right">ยอดเปิด</th>
                  <th className="border px-4 py-2 text-right">ยอดคงเหลือ</th>
                  <th className="border px-4 py-2 text-right">ยอดปิด</th>
                  <th className="border px-4 py-2 text-right">ส่วนต่าง</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(summary.cashBalance).map((cur) => {
                  const open = Number(summary.cashBalance[cur] || 0);
                  const close = Number(summary.closeAmount[cur] || 0);
                  const diff = close - open;
                  let color = diff === 0 ? "text-green-600" : diff < 0 ? "text-red-600" : "text-yellow-600";
                  return (
                    <tr key={cur}>
                      <td className="border px-4 py-2">{cur}</td>
                      <td className="border px-4 py-2 text-right">{open.toLocaleString()}</td>
                      <td className="border px-4 py-2 text-right">{open.toLocaleString()}</td>
                      <td className="border px-4 py-2 text-right">{close.toLocaleString()}</td>
                      <td className={`border px-4 py-2 text-right ${color}`}>{diff.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setSummary(null);
                  router.push("/");
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

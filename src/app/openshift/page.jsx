"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function OpenShiftPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [currencies, setCurrencies] = useState([]);
  const [amounts, setAmounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [shiftNo, setShiftNo] = useState(1);
  const [isOpen, setIsOpen] = useState(false);
  const [checkingOpen, setCheckingOpen] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    const checkOpenShift = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/open-shift/check`);
        const data = await res.json();
        if (data.open) {
          setIsOpen(true);
        }
      } catch (err) {
        console.error("Failed to check open shift:", err);
      } finally {
        setCheckingOpen(false);
      }
    };

    checkOpenShift();
  }, []);

  useEffect(() => {
    if (isOpen) return;
    const fetchCurrencies = async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/posts`);
      const data = await res.json();
      const unique = [...new Set(data.posts.map((p) => p.title))];
      setCurrencies(unique);
      const initialAmounts = {};
      unique.forEach((cur) => (initialAmounts[cur] = ""));
      setAmounts(initialAmounts);
    };
    fetchCurrencies();
  }, [isOpen]);

  useEffect(() => {
    const fetchShiftCount = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/open-shift/count?date=${today}&employee=${session?.user?.name}&branch=${session?.user?.branch}`);
        const data = await res.json();
        setShiftNo(data.count + 1);
      } catch (err) {
        console.error("Failed to fetch shift count:", err);
      }
    };
    if (session?.user?.name) {
      fetchShiftCount();
    }
  }, [session?.user?.name]);

  const handleChange = (currency, value) => {
    setAmounts({ ...amounts, [currency]: value });
  };

  const handleSubmit = async () => {
    setLoading(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/open-shift`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: today,
          shiftNo,
          branch: session?.user?.branch || "",
          country: session?.user?.country || "",
          employee: session?.user?.name || "",
          openAmount: amounts,
          cashBalance: amounts,
        }),
      });

      if (!res.ok) throw new Error("Failed to open shift");

      setMessage("เปิดร้านสำเร็จ");
      setTimeout(() => router.push(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/`), 2000);
    } catch (err) {
      setMessage("เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  };

  if (checkingOpen) {
    return <div className="p-6 text-center">กำลังตรวจสอบสถานะ...</div>;
  }

  if (isOpen) {
    return <div className="p-6 text-center text-red-600">ร้านเปิดอยู่แล้ว ไม่สามารถเปิดซ้ำได้</div>;
  }

  return (
    <div className="max-w-xl mx-auto bg-white p-6 mt-10 shadow rounded">
      <h2 className="text-xl font-bold mb-4">เปิดร้านประจำวัน</h2>
      <p className="mb-2">วันที่: {today}</p>
      <p className="mb-2">พนักงาน: {session?.user?.name}</p>
      <p className="mb-4">สาขา: {session?.user?.branch}</p>
      <p className="mb-2">รอบที่: {shiftNo}</p>

      <form onSubmit={(e) => e.preventDefault()}>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {currencies.map((cur) => (
            <div key={cur}>
              <label className="block font-medium mb-1">
                {cur}:
              </label>
              <input
                type="text"
                value={amounts[cur]?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                onChange={(e) => {
                  const raw = e.target.value.replace(/,/g, "");
                  if (!isNaN(raw)) handleChange(cur, raw);
                }}
                className="w-full border px-3 py-2 rounded"
                placeholder={`ยอดเปิดร้าน (${cur})`}
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className="mt-4 bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700"
        >
          เปิดร้าน
        </button>
      </form>

      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow max-w-sm w-full">
            <h2 className="text-lg font-bold mb-4">ยืนยันการเปิดร้าน</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-sm mb-4">
              {Object.entries(amounts).map(([cur, val]) => (
                <div key={cur}>
                  <span className="font-medium">{cur}:</span> {parseFloat(val || 0).toLocaleString()}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 rounded bg-gray-300 text-black hover:bg-gray-400"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className={`px-4 py-2 rounded text-white ${loading ? "bg-gray-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"}`}
              >
                {loading ? "กำลังบันทึก..." : "ยืนยันการเปิดร้าน"}
              </button>
            </div>
          </div>
        </div>
      )}

      {message && <p className="mt-4 text-center text-sm text-green-600">{message}</p>}
    </div>
  );
}

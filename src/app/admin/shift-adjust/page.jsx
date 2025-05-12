'use client';

import { useState, useEffect } from "react";

export default function ShiftAdjustPage() {
  const [shifts, setShifts] = useState([]);
  const [selectedShift, setSelectedShift] = useState(null);
  const [cashInput, setCashInput] = useState({});
  // Confirm modal states
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(null);

  useEffect(() => {
    async function fetchShifts() {
      const res = await fetch("/api/shifts");
      const data = await res.json();
      const today = new Date().toLocaleDateString("sv-SE"); // yyyy-mm-dd
      const openShifts = data.shifts.filter(
        shift => !shift.closedAt && shift.date === today
      );
      setShifts(openShifts);
    }
    fetchShifts();
  }, []);

  const handleSelectShift = (shift) => {
    setSelectedShift(shift);
    setCashInput({});
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white shadow-md rounded p-6">
      <h1 className="text-2xl font-bold mb-4">ปรับยอดเงินกะ</h1>
      <div className="mb-6">
        <h2 className="font-semibold mb-2">เลือกกะที่ต้องการแก้ไข</h2>
        <select
          className="border p-2 rounded w-full"
          value={selectedShift?._id || ""}
          onChange={(e) => {
            const selected = shifts.find(s => s._id === e.target.value);
            if (selected) {
              setSelectedShift(selected);
              setCashInput({});
            }
          }}
        >
          <option value="">-- เลือกกะ --</option>
          {shifts.map((shift) => (
            <option key={shift._id} value={shift._id}>
              {shift.employee} | กะ: {shift.shiftNo}
            </option>
          ))}
        </select>
      </div>

      {selectedShift && (
        <div>
          <h2 className="font-semibold mb-2">ข้อมูลกะที่เลือก</h2>
          <p>พนักงาน: {selectedShift.employee}</p>
          <p>วันที่: {selectedShift.date}</p>
          <p>รอบกะ: {selectedShift.shiftNo}</p>

          <div className="mt-4">
            <h3 className="font-semibold mb-2">ปรับยอดเงิน:</h3>

            <label className="block mb-1 font-medium">เลือกสกุลเงิน</label>
            <select
              className="border p-2 rounded w-full mb-3"
              value={cashInput.currency || ""}
              onChange={(e) => setCashInput((prev) => ({ ...prev, currency: e.target.value }))}
            >
              <option value="">-- เลือกสกุล --</option>
              {selectedShift.cashBalance &&
                Object.keys(selectedShift.cashBalance).map((cur) => (
                  <option key={cur} value={cur}>{cur}</option>
                ))}
            </select>

            <label className="block mb-1 font-medium">จำนวนเงิน</label>
            <input
              type="text"
              className="border p-2 rounded w-full mb-3"
              value={
                cashInput.amount !== undefined && cashInput.amount !== ""
                  ? Number(cashInput.amount).toLocaleString()
                  : ""
              }
              onChange={(e) => {
                const val = e.target.value.replace(/,/g, "");
                setCashInput((prev) => ({ ...prev, amount: val }));
              }}
            />

            <div className="mb-3">
              <label className="mr-4">
                <input
                  type="radio"
                  name="action"
                  value="increase"
                  checked={cashInput.action === "increase"}
                  onChange={(e) => setCashInput((prev) => ({ ...prev, action: e.target.value }))}
                /> เพิ่ม
              </label>
              <label className="ml-4">
                <input
                  type="radio"
                  name="action"
                  value="decrease"
                  checked={cashInput.action === "decrease"}
                  onChange={(e) => setCashInput((prev) => ({ ...prev, action: e.target.value }))}
                /> ลด
              </label>
            </div>

            <button
              disabled={
                !cashInput.currency ||
                !cashInput.amount ||
                !cashInput.action
              }
              onClick={() => {
                const original = selectedShift.cashBalance?.[cashInput.currency] || 0;
                const newAmount =
                  cashInput.action === "increase"
                    ? Number(original) + parseFloat(cashInput.amount)
                    : Number(original) - parseFloat(cashInput.amount);

                setPendingSubmit({
                  shiftId: selectedShift._id,
                  currency: cashInput.currency,
                  original,
                  amount: parseFloat(cashInput.amount),
                  action: cashInput.action,
                  newAmount,
                });
                setShowConfirm(true);
              }}
              className={`px-4 py-2 rounded text-white ${
                !cashInput.currency || !cashInput.amount || !cashInput.action
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              บันทึกการแก้ไข
            </button>
          </div>
        </div>
      )}
      {/* Confirm Modal */}
      {showConfirm && pendingSubmit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded shadow-lg p-6 max-w-md w-full">
            <h2 className="text-lg font-bold mb-4">ยืนยันการปรับยอดเงิน</h2>
            <p>
              <strong>สกุลเงิน:</strong> {pendingSubmit.currency}
            </p>
            <p>
              <strong>ยอดเดิม:</strong> {Number(pendingSubmit.original).toLocaleString()}
            </p>
            <p>
              <strong>
                {pendingSubmit.action === "increase" ? "เพิ่ม" : "ลด"}:
              </strong>{" "}
              {Number(pendingSubmit.amount).toLocaleString()}
            </p>
            <p>
              <strong>ยอดใหม่:</strong> {Number(pendingSubmit.newAmount).toLocaleString()}
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                className="px-4 py-2 bg-gray-300 rounded"
                onClick={() => {
                  setShowConfirm(false);
                  setPendingSubmit(null);
                }}
              >
                ยกเลิก
              </button>
              <button
                className="px-4 py-2 bg-green-600 text-white rounded"
                onClick={async () => {
                  const updatePayload = {
                    docNumber: `CD${Date.now()}`,
                    action: pendingSubmit.action,
                    shiftNo: selectedShift.shiftNo,
                    employee: selectedShift.employee,
                  };

                  if (pendingSubmit.currency === "THB") {
                    updatePayload.totalTHB = pendingSubmit.amount;
                  } else {
                    updatePayload.currency = pendingSubmit.currency;
                    updatePayload.amount = pendingSubmit.amount;
                  }

                  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/open-shift/update-cash`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(updatePayload),
                  });

                  const data = await res.json();
                  alert(data.message || "อัปเดตสำเร็จ");
                  setShowConfirm(false);
                  setPendingSubmit(null);
                  setTimeout(() => {
                    try {
                      window.open('', '_self')?.close(); // fallback method
                      window.close();
                    } catch (e) {
                      console.warn("ไม่สามารถปิดหน้าต่างได้โดยตรง:", e);
                    }
                  }, 200); // ปิดหลัง alert เพื่อไม่ให้ block
                }}
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

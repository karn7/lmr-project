"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function EditStockPage() {
  const searchParams = useSearchParams();
  const branch = searchParams.get("branch") || "ALL";

  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [deleteStartDate, setDeleteStartDate] = useState("");
  const [deleteEndDate, setDeleteEndDate] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [editableData, setEditableData] = useState([]);

  useEffect(() => {
    if (!selectedDate || isDeleting) return;
    const controller = new AbortController();
    fetch(`/api/dailystocks?date=${selectedDate}&branch=${encodeURIComponent(branch)}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data?.stocks?.[0]?.items)) {
          setEditableData(data.stocks[0].items);
        } else {
          setEditableData([]);
        }
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        console.error("โหลดข้อมูลสต๊อกล้มเหลว:", err);
        setEditableData([]);
      });
    return () => controller.abort();
  }, [selectedDate, branch, isDeleting]);

  const handleChange = (index, field, value) => {
    const newData = [...editableData];
    newData[index] = { ...newData[index], [field]: value };
    setEditableData(newData);
  };

  const handleDelete = async (startDate, endDate) => {
    if (isDeleting) return;
    if (!branch || branch === "ALL") {
      alert("กรุณาเลือกสาขาก่อนลบสต๊อก");
      return;
    }
    if (!startDate || !endDate || startDate > endDate) {
      alert("กรุณาเลือกช่วงวันที่ให้ถูกต้อง โดยวันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด");
      return;
    }
    const period = startDate === endDate ? startDate : `${startDate} ถึง ${endDate} (รวมวันเริ่มต้นและวันสิ้นสุด)`;
    if (!confirm(`ยืนยันลบสต๊อกทั้งหมดของสาขา ${branch} วันที่ ${period}? การลบไม่สามารถย้อนกลับได้`)) return;
    setIsDeleting(true);
    try {
      const res = await fetch("/api/dailystocks/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate, branch }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        alert("❌ ลบสต๊อกล้มเหลว: " + (result.message || "เกิดข้อผิดพลาด"));
        return;
      }
      if (selectedDate >= startDate && selectedDate <= endDate) {
        setEditableData([]);
      }
      alert(`🗑️ ลบสต๊อกสำเร็จ ${result.deleted} รายการ`);
    } catch (err) {
      console.error("เกิดข้อผิดพลาด:", err);
      alert("❌ ลบสต๊อกล้มเหลว");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">แก้ไขสต๊อกตามวันที่</h1>
      <p className="mb-2">สาขา: {branch}</p>
      <input
        aria-label="วันที่แก้ไขสต๊อก"
        disabled={isDeleting}
        type="date"
        className="border rounded px-3 py-2 mb-4"
        value={selectedDate}
        onChange={(e) => setSelectedDate(e.target.value)}
      />

      <table className="w-full border border-gray-300">
        <thead>
          <tr className="bg-gray-200">
            <th className="border px-2 py-1">Currency</th>
            <th className="border px-2 py-1">Carry Over</th>
            <th className="border px-2 py-1">In/Out Total</th>
            <th className="border px-2 py-1">Average Rate</th>
            <th className="border px-2 py-1">Actual</th>
          </tr>
        </thead>
        <tbody>
          {editableData.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-center py-4">ไม่มีข้อมูล</td>
            </tr>
          ) : (
            editableData.map((item, index) => (
              <tr key={index}>
                <td className="border px-2 py-1">
                  {item.currency}
                </td>
                <td className="border px-2 py-1">
                  <input
                    type="text"
                    value={item.carryOver ?? ""}
                    onChange={(e) => handleChange(index, "carryOver", e.target.value)}
                    className="w-full border px-2 py-1"
                  />
                </td>
                <td className="border px-2 py-1">
                  <input
                    type="text"
                    value={item.inOutTotal ?? ""}
                    onChange={(e) => handleChange(index, "inOutTotal", e.target.value)}
                    className="w-full border px-2 py-1"
                  />
                </td>
                <td className="border px-2 py-1">
                  <input
                    type="text"
                    value={item.averageRate ?? ""}
                    onChange={(e) => handleChange(index, "averageRate", e.target.value)}
                    className="w-full border px-2 py-1"
                  />
                </td>
                <td className="border px-2 py-1">
                  <input
                    type="text"
                    value={item.actual ?? ""}
                    onChange={(e) => handleChange(index, "actual", e.target.value)}
                    className="w-full border px-2 py-1"
                  />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <button
        disabled={isDeleting}
        className="mt-4 bg-blue-500 text-white px-4 py-2 rounded"
        onClick={async () => {
          try {
            const res = await fetch("/api/dailystocks/update", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                date: selectedDate,
                branch,
                items: editableData,
              }),
            });
            const result = await res.json();
            if (result.success) {
              alert("✅ บันทึกสำเร็จ");
            } else {
              alert("❌ บันทึกล้มเหลว: " + result.message);
            }
          } catch (err) {
            console.error("เกิดข้อผิดพลาด:", err);
            alert("❌ บันทึกล้มเหลว");
          }
        }}
      >
        บันทึกการแก้ไข
      </button>
      <button
        className="mt-4 bg-red-500 text-white px-4 py-2 rounded ml-2 disabled:opacity-50"
        disabled={isDeleting || !selectedDate || branch === "ALL"}
        onClick={() => handleDelete(selectedDate, selectedDate)}
      >
        ลบสต๊อกวันที่เลือก
      </button>

      <section className="mt-8 border border-red-200 rounded p-4">
        <h2 className="font-bold mb-2">ลบสต๊อกตามช่วงวันที่</h2>
        <p className="text-sm text-gray-600 mb-4">
          ลบทุกรายการสต๊อกรายวันของสาขา {branch} ในช่วงที่เลือก รวมวันเริ่มต้นและวันสิ้นสุด
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            วันที่เริ่มต้น
            <input
              type="date"
              className="border rounded px-3 py-2"
              value={deleteStartDate}
              max={deleteEndDate || undefined}
              disabled={isDeleting}
              onChange={(e) => setDeleteStartDate(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            วันที่สิ้นสุด
            <input
              type="date"
              className="border rounded px-3 py-2"
              value={deleteEndDate}
              min={deleteStartDate || undefined}
              disabled={isDeleting}
              onChange={(e) => setDeleteEndDate(e.target.value)}
            />
          </label>
          <button
            className="bg-red-600 text-white px-4 py-2 rounded disabled:opacity-50"
            disabled={isDeleting || branch === "ALL" || !deleteStartDate || !deleteEndDate || deleteStartDate > deleteEndDate}
            onClick={() => handleDelete(deleteStartDate, deleteEndDate)}
          >
            {isDeleting ? "กำลังลบ..." : "ลบสต๊อกในช่วงวันที่"}
          </button>
        </div>
      </section>
    </div>
  );
}

export default function Wrapper() {
  return (
    <Suspense>
      <EditStockPage />
    </Suspense>
  );
}
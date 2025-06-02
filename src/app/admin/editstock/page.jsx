"export const dynamic = \"force-dynamic\";"
"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function EditStockPage() {
  const searchParams = useSearchParams();
  const branch = searchParams.get("branch") || "ALL";

  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [stockData, setStockData] = useState([]);
  const [editableData, setEditableData] = useState([]);

  useEffect(() => {
    if (!selectedDate) return;
    fetch(`/api/dailystocks?date=${selectedDate}&branch=${branch}`)
      .then((res) => res.json())
      .then((data) => {
        console.log("📦 ข้อมูลจาก API:", data);
        if (Array.isArray(data?.stocks?.[0]?.items)) {
          setStockData(data.stocks[0].items);
          setEditableData(data.stocks[0].items);
        } else {
          setStockData([]);
          setEditableData([]);
        }
      })
      .catch((err) => {
        console.error("โหลดข้อมูลสต๊อกล้มเหลว:", err);
        setStockData([]);
        setEditableData([]);
      });
  }, [selectedDate, branch]);

  const handleChange = (index, field, value) => {
    const newData = [...editableData];
    newData[index] = { ...newData[index], [field]: value };
    setEditableData(newData);
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">แก้ไขสต๊อกตามวันที่</h1>
      <input
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
    </div>
  );
}
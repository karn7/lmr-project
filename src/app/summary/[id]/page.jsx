"use client";
 
 import { useParams, useRouter } from "next/navigation";
 import { useEffect, useState } from "react";
 
 export default function SummaryPage() {
   const { id } = useParams();
   const router = useRouter();
 
  const [data, setData] = useState(null);
  const [calculation, setCalculation] = useState({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editCloseAmount, setEditCloseAmount] = useState({});
  const [editReason, setEditReason] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
 const [saving, setSaving] = useState(false);
 const [checkingPrevious, setCheckingPrevious] = useState(false);
 const [showCheckModal, setShowCheckModal] = useState(false);
 const [previousShift, setPreviousShift] = useState(null);
 const [checkDiffs, setCheckDiffs] = useState([]);
 const [checkMessage, setCheckMessage] = useState("");
 
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/shift-summary?id=${id}`);
        const result = await res.json();
        if (res.ok) {
          console.log("✅ API result", result);
          setData(result);
          const cal = {};
          if (result.cashBalance && result.closeAmount) {
            for (const cur in result.cashBalance) {
              const open = Number(result.cashBalance[cur]);
              const close = Number(result.closeAmount[cur] || 0);
              cal[cur] = close - open;
            }
          }
          setCalculation(cal);
        } else {
          setError(result.message || "ไม่สามารถโหลดข้อมูลได้");
        }
      } catch (err) {
        console.error("Error loading summary:", err);
        setError("เกิดข้อผิดพลาดในการดึงข้อมูล");
      }
    };

    if (id) fetchData();
  }, [id]);

  const recalculate = (nextData) => {
    const cal = {};
    if (nextData.cashBalance && nextData.closeAmount) {
      for (const cur in nextData.cashBalance) {
        const open = Number(nextData.cashBalance[cur]);
        const close = Number(nextData.closeAmount[cur] || 0);
        cal[cur] = close - open;
      }
    }
    setCalculation(cal);
  };

  const openEditModal = () => {
    setEditCloseAmount(data.closeAmount || {});
    setEditReason("");
    setMessage("");
    setShowEditModal(true);
  };

  const handleEditAmountChange = (currency, value) => {
    setEditCloseAmount((prev) => ({ ...prev, [currency]: value }));
  };

  const sendNotification = async ({ type, reason, afterCloseAmount }) => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/Notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docNumber: id,
          employee: data?.employee || "",
          message:
            type === "deleteRequest"
              ? `ขอลบรอบเปิด-ปิดร้าน ${id}`
              : `ขอแก้ไขยอดปิดร้าน ${id}`,
          type,
          details: {
            reason,
            date: data?.date,
            shiftNo: data?.shiftNo,
            branch: data?.branch,
            beforeCloseAmount: data?.closeAmount || {},
            afterCloseAmount: afterCloseAmount || {},
          },
        }),
      });
    } catch (err) {
      console.error("Notification error:", err);
    }
  };

  const handleSaveEdit = async () => {
    if (!editReason.trim()) {
      setMessage("กรุณาระบุเหตุผลในการแก้ไข");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/shift-summary?id=${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          closeAmount: editCloseAmount,
          reason: editReason,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "ไม่สามารถแก้ไขข้อมูลได้");

      const nextData = { ...data, closeAmount: editCloseAmount };
      setData(nextData);
      recalculate(nextData);
      await sendNotification({
        type: "editRequest",
        reason: editReason,
        afterCloseAmount: editCloseAmount,
      });

      setShowEditModal(false);
      setMessage("แก้ไขข้อมูลสำเร็จ");
    } catch (err) {
      console.error("Edit error:", err);
      setMessage(err.message || "เกิดข้อผิดพลาดในการแก้ไขข้อมูล");
    } finally {
      setSaving(false);
    }
  };

 const handleDelete = async () => {
    if (!deleteReason.trim()) {
      setMessage("กรุณาระบุเหตุผลในการลบ");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/shift-summary?id=${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: deleteReason,
          employee: data?.employee || "",
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "ไม่สามารถลบข้อมูลได้");

      await sendNotification({ type: "deleteRequest", reason: deleteReason });
      setShowDeleteModal(false);
      setMessage("ลบข้อมูลสำเร็จ");
      router.push(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/`);
    } catch (err) {
      console.error("Delete error:", err);
      setMessage(err.message || "เกิดข้อผิดพลาดในการลบข้อมูล");
    } finally {
      setSaving(false);
    }
  };
 
   // --- Check previous shift helpers ---
   const buildOpenVsPreviousDiffs = (openAmounts, previousCloseAmounts) => {
     const allCurrencies = Array.from(
       new Set([
         ...Object.keys(openAmounts || {}),
         ...Object.keys(previousCloseAmounts || {}),
       ])
     );
 
     return allCurrencies.map((cur) => {
       const openValue = Number(openAmounts?.[cur] || 0);
       const previousCloseValue = Number(previousCloseAmounts?.[cur] || 0);
       return {
         currency: cur,
         previousCloseValue,
         openValue,
         diff: openValue - previousCloseValue,
       };
     });
   };
 
   const handleCheckPreviousShift = async () => {
     setCheckingPrevious(true);
     setCheckMessage("");
     setPreviousShift(null);
     setCheckDiffs([]);
 
     try {
       const params = new URLSearchParams({
         date: data?.date || "",
         employee: data?.employee || "",
         branch: data?.branch || "",
       });
 
       const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/closeshift?${params.toString()}`);
       const result = await res.json();
 
       if (!res.ok) {
         throw new Error(result.message || "ไม่สามารถตรวจสอบกะล่าสุดเมื่อวานได้");
       }
 
       if (!result?.found || !result?.closeAmount) {
         setCheckMessage("ไม่พบข้อมูลปิดร้านของกะล่าสุดเมื่อวานสำหรับใช้ตรวจสอบ");
         setShowCheckModal(true);
         return;
       }
 
       setPreviousShift(result);
       setCheckDiffs(buildOpenVsPreviousDiffs(data?.openAmount || {}, result.closeAmount || {}));
       setShowCheckModal(true);
     } catch (err) {
       console.error("Check previous shift error:", err);
       setCheckMessage(err.message || "เกิดข้อผิดพลาดในการตรวจสอบรายการ");
       setShowCheckModal(true);
     } finally {
       setCheckingPrevious(false);
     }
   };
 
   if (error) return <div className="p-6 text-red-500">{error}</div>;
   if (!data) return <div className="p-6">กำลังโหลด...</div>;
 
  return (
    <div className="max-w-3xl mx-auto p-6 bg-white shadow rounded">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-xl font-bold">สรุปผลการเปิด-ปิดร้าน</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCheckPreviousShift}
            disabled={checkingPrevious}
            className="px-3 py-2 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50"
          >
            {checkingPrevious ? "กำลังตรวจสอบ..." : "ตรวจสอบรายการ"}
          </button>
          <button
            type="button"
            onClick={openEditModal}
            className="px-3 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
          >
            แก้ไข
          </button>
          <button
            type="button"
            onClick={() => {
              setDeleteReason("");
              setMessage("");
              setShowDeleteModal(true);
            }}
            className="px-3 py-2 rounded bg-red-600 text-white text-sm hover:bg-red-700"
          >
            ลบ
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded">
          {message}
        </div>
      )}
      {!data.closeAmount && (
        <div className="mb-4 p-3 bg-yellow-100 border border-yellow-300 text-yellow-800 rounded">
          ⚠️ รอบนี้ยังไม่ทำการปิดร้าน
        </div>
      )}
      <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>📅 วันที่: <strong>{data.date}</strong></div>
        <div>🕘 รอบที่: <strong>{data.shiftNo}</strong></div>
        <div>🏪 สาขา: <strong>{data.branch}</strong></div>
        <div>👤 พนักงาน: <strong>{data.employee}</strong></div>
      </div>

      <table className="w-full text-left border">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 border">สกุลเงิน</th>
            <th className="p-2 border">ยอดเปิดร้าน</th>
            <th className="p-2 border">ยอดคงเหลือในระบบ</th>
            <th className="p-2 border">ยอดปิดร้าน</th>
            <th className="p-2 border">ส่วนต่าง</th>
          </tr>
        </thead>
        <tbody>
          {Object.keys(data.cashBalance).map((cur) => {
            const diff = calculation[cur] || 0;
            let color = "text-green-600";
            if (diff < 0) color = "text-red-600";
            else if (diff > 0) color = "text-yellow-600";
            return (
              <tr key={cur}>
                <td className="p-2 border">{cur}</td>
                <td className="p-2 border">{Number(data.openAmount?.[cur] || 0).toLocaleString()}</td>
                <td className="p-2 border">{Number(data.cashBalance[cur]).toLocaleString()}</td>
                <td className="p-2 border">{Number(data.closeAmount?.[cur] || 0).toLocaleString()}</td>
                <td className={`p-2 border ${color}`}>{diff.toLocaleString()}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {showEditModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded shadow max-w-5xl w-full p-5 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">แก้ไขยอดปิดร้าน</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              {Object.keys(data.cashBalance || {}).map((cur) => (
                <label key={cur} className="block">
                  <span className="text-sm font-medium">{cur}</span>
                  <input
                    type="number"
                    value={editCloseAmount?.[cur] ?? ""}
                    onChange={(e) => handleEditAmountChange(cur, e.target.value)}
                    className="mt-1 w-full border rounded p-2"
                  />
                </label>
              ))}
            </div>

            <label className="block mb-4">
              <span className="text-sm font-medium">เหตุผลในการแก้ไข</span>
              <textarea
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                className="mt-1 w-full border rounded p-2"
                rows={3}
                placeholder="ระบุเหตุผล เช่น กรอกยอดผิด / ตรวจนับใหม่แล้วพบว่ายอดถูกต้อง"
              />
            </label>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                disabled={saving}
                className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={saving}
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded shadow max-w-md w-full p-5">
            <h2 className="text-lg font-bold mb-2 text-red-700">ยืนยันการลบข้อมูล</h2>
            <p className="mb-4 text-sm text-gray-700">
              การลบข้อมูลรอบนี้อาจกระทบยอดเปิด-ปิดร้าน กรุณาระบุเหตุผลก่อนลบ
            </p>

            <label className="block mb-4">
              <span className="text-sm font-medium">เหตุผลในการลบ</span>
              <textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="mt-1 w-full border rounded p-2"
                rows={3}
                placeholder="ระบุเหตุผลในการลบ"
              />
            </label>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={saving}
                className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? "กำลังลบ..." : "ยืนยันลบ"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showCheckModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded shadow max-w-4xl w-full p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-bold">ตรวจสอบยอดเปิดร้านกับกะล่าสุดเมื่อวาน</h2>
              <button
                type="button"
                onClick={() => setShowCheckModal(false)}
                className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
              >
                ปิด
              </button>
            </div>
 
            {checkMessage && (
              <div className="mb-4 p-3 rounded bg-yellow-50 border border-yellow-300 text-yellow-800">
                {checkMessage}
              </div>
            )}
 
            {previousShift && (
              <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                <div>วันที่ปิดล่าสุด: <strong>{previousShift.date || previousShift.previousDate}</strong></div>
                <div>รอบปิดล่าสุด: <strong>{previousShift.shiftNo}</strong></div>
                <div>สาขา: <strong>{previousShift.branch || data.branch}</strong></div>
                <div>พนักงาน: <strong>{previousShift.employee || data.employee}</strong></div>
              </div>
            )}
 
            {checkDiffs.length > 0 && (
              <table className="w-full text-left border text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 border">สกุลเงิน</th>
                    <th className="p-2 border">ยอดปิดกะล่าสุดเมื่อวาน</th>
                    <th className="p-2 border">ยอดเปิดกะนี้</th>
                    <th className="p-2 border">ส่วนต่าง</th>
                  </tr>
                </thead>
                <tbody>
                  {checkDiffs.map((item) => {
                    let color = "text-green-600";
                    if (item.diff < 0) color = "text-red-600";
                    else if (item.diff > 0) color = "text-yellow-600";
 
                    return (
                      <tr key={item.currency}>
                        <td className="p-2 border font-medium">{item.currency}</td>
                        <td className="p-2 border">{item.previousCloseValue.toLocaleString()}</td>
                        <td className="p-2 border">{item.openValue.toLocaleString()}</td>
                        <td className={`p-2 border font-medium ${color}`}>{item.diff.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
 }

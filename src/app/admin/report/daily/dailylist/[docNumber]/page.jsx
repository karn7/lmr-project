"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

export default function Page({ params }) {
  const docNumber = params.docNumber;
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editableRecord, setEditableRecord] = useState(null);
  const [docLogData, setDocLogData] = useState([]);
  const router = useRouter();
  const cashUpdated = useRef(false);
  // --- Fetch adjustment log by docNumber ---
  useEffect(() => {
    if (!record?.docNumber) return;

    const fetchDocLogs = async () => {
      try {
        const res = await fetch(`/api/AdjustmentLog?docNumber=${record.docNumber}`);
        const data = await res.json();
        setDocLogData(data.logs || []);
      } catch (err) {
        console.error("❌ Error loading docNumber logs:", err);
      }
    };

    fetchDocLogs();
  }, [record?.docNumber]);

  useEffect(() => {
    if (!docNumber) return;

    const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

    async function fetchRecord() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${base}/api/record/${docNumber}`);
        if (!res.ok) {
          throw new Error("Failed to fetch record");
        }
        const data = await res.json();
        setRecord(data.record);
        // reset editing state if record changes
        setIsEditing(false);
        setEditableRecord(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchRecord();
  }, [docNumber]);

  async function updateCashOnDeleteOnly() {
    if (cashUpdated.current) {
      console.log("⛔ updateCashOnDeleteOnly() ถูกบล็อก ไม่ให้ทำซ้ำ");
      return;
    }

    // ต้องมีข้อมูลกะ/เอกสารเพื่อปรับยอด
    if (!record || !record.shiftNo || !record.docNumber) {
      console.warn("⚠️ ข้อมูลไม่ครบ ไม่สามารถอัปเดตเงินสดได้", record);
      return;
    }

    cashUpdated.current = true;

    const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

    // ✅ แนวทางใหม่: ใช้ Log การปรับยอด แล้วทำ “ตรงกันข้าม” ตอนลบ
    // เช่น increase -> decrease, decrease -> increase
    const invertAction = (action) => {
      if (action === "increase") return "decrease";
      if (action === "decrease") return "increase";
      return action;
    };

    try {
      if (Array.isArray(docLogData) && docLogData.length > 0) {
        console.log("🧾 ใช้ docLogData เพื่อย้อนกลับการปรับยอด:", docLogData);

        for (const log of docLogData) {
          // กันเคส log ไม่สมบูรณ์
          if (!log?.currency || log?.amount == null || !log?.action) continue;

          await fetch(`${base}/api/open-shift/update-cash`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              shiftNo: record.shiftNo,
              docNumber: record.docNumber,
              // ใช้ชื่อพนักงานในรายการ (หรือ user) เพื่อความสอดคล้องกับของเดิม
              employee: record.employee || (record?.user?.name ?? ""),
              date: record.date,
              currency: log.currency,
              amount: log.amount,
              action: invertAction(log.action),
            }),
          });
        }

        return; // จบที่นี่ ไม่ต้องคำนวณจาก record แบบเดิม
      }

      // 🔁 Fallback: ถ้าไม่มี log ให้ใช้สูตรเดิม (กันระบบพังในรายการเก่า)
      console.warn("⚠️ ไม่พบ docLogData สำหรับรายการนี้ — ใช้การคำนวณแบบเดิมแทน");

      let updates = [];

      if (!record.payType || record.total == null) {
        console.warn("⚠️ ข้อมูลไม่ครบ ไม่สามารถคำนวณ updates แบบเดิมได้", record);
        return;
      }

      if (record.payType === "Buying") {
        if (record.payMethod === "cash") {
          updates.push({
            currency: "THB",
            amount: record.total,
            action: "increase",
          });
        }
        if (record.items && record.items.length > 0) {
          record.items.forEach((item) => {
            updates.push({
              currency: item.currency,
              amount: item.amount,
              action: "decrease",
            });
          });
        }
      } else if (record.payType === "Selling") {
        if (record.receiveMethod === "cash") {
          updates.push({
            currency: "THB",
            amount: record.total,
            action: "decrease",
          });
        }
        if (record.items && record.items.length > 0) {
          record.items.forEach((item) => {
            updates.push({
              currency: item.currency,
              amount: item.amount,
              action: "increase",
            });
          });
        }
      } else if (record.payType === "NP(B)") {
        if (record.payMethod === "cash") {
          updates.push({
            currency: "THB",
            amount: record.total,
            action: "increase",
          });
        }
        if (record.items && record.items.length > 0) {
          record.items.forEach((item) => {
            updates.push({
              currency: item.currency,
              amount: item.amount,
              action: "decrease",
            });
          });
        }
      } else if (record.payType === "NP(S)") {
        if (record.receiveMethod === "cash") {
          updates.push({
            currency: "THB",
            amount: record.total,
            action: "decrease",
          });
        }
        if (record.items && record.items.length > 0) {
          record.items.forEach((item) => {
            updates.push({
              currency: item.currency,
              amount: item.amount,
              action: "increase",
            });
          });
        }
      } else if (record.payType === "Wechat") {
        updates.push({
          currency: "THB",
          amount: record.total,
          action: "increase",
        });
      } else if (record.payType === "Lottery") {
        updates.push({
          currency: "THB",
          amount: record.total,
          action: "increase",
        });
      } else if (record.payType === "deposit") {
        if (record.items && record.items.length > 0) {
          record.items.forEach((item) => {
            updates.push({
              currency: item.currency,
              amount: item.total,
              action: "decrease",
            });
          });
        }
      } else if (record.payType === "withdraw") {
        if (record.items && record.items.length > 0) {
          record.items.forEach((item) => {
            updates.push({
              currency: item.currency,
              amount: item.total,
              action: "increase",
            });
          });
        }
      }

      console.log("📤 updates ที่จะส่งไป update-cash (fallback):", updates);

      if (updates.length > 0) {
        for (const update of updates) {
          await fetch(`${base}/api/open-shift/update-cash`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              shiftNo: record.shiftNo,
              docNumber: record.docNumber,
              employee: record.employee || (record?.user?.name ?? ""),
              date: record.date,
              ...update,
            }),
          });
        }
      } else {
        console.warn("⚠️ ไม่พบข้อมูล update-cash ที่ต้องส่ง (fallback)");
      }
    } catch (error) {
      console.error("❌ Failed to update cash:", error);
    }
  }

  if (loading) return <div className="text-left p-4">Loading...</div>;
  if (error) return <div className="text-left p-4 text-red-600">Error: {error}</div>;
  if (!record) return <div className="text-left p-4">No record found.</div>;

  const options = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };
  const formattedDate = new Date(record.createdAt).toLocaleString("th-TH", options).replace(",", " เวลา");

  // For editing: derive timeOnly string from createdAt
  function getTimeOnly(dateStr) {
    const d = new Date(dateStr);
    const h = d.getHours().toString().padStart(2, "0");
    const m = d.getMinutes().toString().padStart(2, "0");
    return `${h}:${m}`;
  }

  // PayType options for editing
  const payTypeOptions = [
    "Buying",
    "Selling",
    "NP(B)",
    "NP(S)",
    "Wechat",
    "Lottery",
    "deposit",
    "withdraw",
    "Wholesale"
  ];

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
      const dateParam = record.date || new Date(record.createdAt).toISOString().slice(0, 10);
      console.log("🔍 ตรวจสอบกะด้วยค่า:", {
        shiftNo: record.shiftNo,
        employee: record.employee,
        date: dateParam,
      });
      const resCheck = await fetch(`${base}/api/open-shift/check?shiftNo=${record.shiftNo}&employee=${encodeURIComponent(record.employee)}&date=${encodeURIComponent(dateParam)}`);
      if (!resCheck.ok) {
        alert("เกิดข้อผิดพลาดในการตรวจสอบกะ");
        return;
      }
      const dataCheck = await resCheck.json();
      console.log("🕵️‍♂️ ข้อมูลที่ได้จาก /api/open-shift/check:", dataCheck);

      let message = "";
      if (dataCheck.open) {
        message = "กะยังไม่ถูกปิด จะมีการปรับยอดเงิน\n";
      } else {
        message = "กะถูกปิดแล้ว กำลังลบข้อมูลย้อนหลัง\n";
      }
      message += "คุณต้องการลบรายการนี้หรือไม่?\n\n";

      if (dataCheck.open) {
        // Determine the effect on balances
        // ✅ แนวทางใหม่: แสดงสิ่งที่จะ “ย้อนกลับ” จาก Log การปรับยอด (ถ้ามี)
        const invertAction = (action) => {
          if (action === "increase") return "decrease";
          if (action === "decrease") return "increase";
          return action;
        };

        if (Array.isArray(docLogData) && docLogData.length > 0) {
          message += `- จะย้อนกลับการปรับยอดตาม Log (${docLogData.length} รายการ):\n`;
          docLogData.forEach((log) => {
            if (!log?.currency || log?.amount == null || !log?.action) return;
            const opposite = invertAction(log.action);
            message += `  * ${log.currency}: ${Number(log.amount).toLocaleString("th-TH", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} (${opposite})\n`;
          });
        } else {
          // 🔁 Fallback เดิม: ถ้าไม่มี log ให้แสดงตามการคำนวณจาก record
          if (record.payType === "Buying" || record.payType === "Selling") {
            const isPayCash = record.payMethod === "cash";
            const isReceiveCash = record.receiveMethod === "cash";

            if (record.payType === "Buying") {
              if (isPayCash) {
                message += `- เงินสด (THB) จะเพิ่มขึ้น ${record.total.toLocaleString("th-TH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}\n`;
              }
              if (record.items && record.items.length > 0) {
                message += `- สกุลเงินในรายการจะลดลง:\n`;
                record.items.forEach((item) => {
                  message += `  * ${item.currency}: ${item.amount.toLocaleString("th-TH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}\n`;
                });
              }
            } else if (record.payType === "Selling") {
              if (isReceiveCash) {
                message += `- เงินสด (THB) จะลดลง ${record.total.toLocaleString("th-TH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}\n`;
              }
              if (record.items && record.items.length > 0) {
                message += `- สกุลเงินในรายการจะเพิ่มขึ้น:\n`;
                record.items.forEach((item) => {
                  message += `  * ${item.currency}: ${item.amount.toLocaleString("th-TH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}\n`;
                });
              }
            }
          } else if (record.payType === "NP(B)") {
            if (record.payMethod === "cash") {
              message += `- เงินสด (THB) จะเพิ่มขึ้น ${record.total.toLocaleString("th-TH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}\n`;
            }
            if (record.items && record.items.length > 0) {
              message += `- สกุลเงินในรายการจะลดลง:\n`;
              record.items.forEach((item) => {
                message += `  * ${item.currency}: ${item.amount.toLocaleString("th-TH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}\n`;
              });
            }
          } else if (record.payType === "NP(S)") {
            if (record.receiveMethod === "cash") {
              message += `- เงินสด (THB) จะลดลง ${record.total.toLocaleString("th-TH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}\n`;
            }
            if (record.items && record.items.length > 0) {
              message += `- สกุลเงินในรายการจะเพิ่มขึ้น:\n`;
              record.items.forEach((item) => {
                message += `  * ${item.currency}: ${item.amount.toLocaleString("th-TH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}\n`;
              });
            }
          } else if (record.payType === "Wechat") {
            message += `- เงินสด (THB) จะเพิ่มขึ้น ${record.total.toLocaleString("th-TH", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}\n`;
          } else if (record.payType === "Lottery") {
            message += `- เงินสด (THB) จะเพิ่มขึ้น ${record.total.toLocaleString("th-TH", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}\n`;
          } else if (record.payType === "deposit") {
            if (record.items && record.items.length > 0) {
              message += `- สกุลเงินในรายการจะลดลง:\n`;
              record.items.forEach((item) => {
                message += `  * ${item.currency}: ${
                  item.total != null
                    ? item.total.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : "-"
                }\n`;
              });
            }
          } else if (record.payType === "withdraw") {
            if (record.items && record.items.length > 0) {
              message += `- สกุลเงินในรายการจะเพิ่มขึ้น:\n`;
              record.items.forEach((item) => {
                message += `  * ${item.currency}: ${
                  item.total != null
                    ? item.total.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : "-"
                }\n`;
              });
            }
          }
        }
      }

      if (confirm(message)) {
        if (dataCheck.open) {
          await updateCashOnDeleteOnly();
        } else {
          console.log("📦 ข้าม updateCashOnDeleteOnly เพราะกะถูกปิดแล้ว");
        }

        const resDelete = await fetch(`${base}/api/record/delete`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ docNumber: record.docNumber }),
        });
        if (!resDelete.ok) {
          alert("ลบรายการไม่สำเร็จ");
          return;
        }
        router.push("/admin/report/daily");
      }
    } catch (error) {
      alert("เกิดข้อผิดพลาด: " + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handler for entering edit mode
  function handleEditClick() {
    // Deep clone and add timeOnly field, include _id
    setEditableRecord({
      ...record,
      _id: record._id,
      // For timeOnly, use createdAt
      timeOnly: getTimeOnly(record.createdAt),
      // Deep clone items for safety, support add if no items
      items:
        record.items && record.items.length > 0
          ? record.items.map((item) => ({ ...item }))
          : [
              {
                currency: "",
                unit: "",
                rate: "",
                amount: "",
                total: "",
              },
            ],
    });
    setIsEditing(true);
  }

  // Handler for cancel edit
  function handleCancelEdit() {
    setIsEditing(false);
    setEditableRecord(null);
  }

  // Handler for save edit
  async function handleSaveEdit() {
    try {
      // Recalculate totals, ensure amount, rate, total are numeric and total is rounded to 2 decimal places
      let newTotal = 0;
      const updatedItems = editableRecord.items.map((item) => {
        const amount = parseFloat(item.amount) || 0;
        const rate = parseFloat(item.rate) || 0;
        const total = parseFloat((amount * rate).toFixed(2));
        newTotal += total;
        return { ...item, amount, rate, total };
      });
      const updatedRecord = {
        ...editableRecord,
        items: updatedItems,
        total: newTotal,
      };
      const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
      // Compose payload
      const payload = {
  _id: updatedRecord._id,
  docNumber: updatedRecord.docNumber,
  payType: updatedRecord.payType,
  payMethod: updatedRecord.payMethod,
  receiveMethod: updatedRecord.receiveMethod,
  createdAt: updatedRecord.createdAt,
  customerName: updatedRecord.customerName,
  items: updatedRecord.items,
  total: updatedRecord.total,
};
      console.log("📤 payload ที่จะส่ง:", payload);
      const res = await fetch(`${base}/api/record/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        alert("บันทึกการแก้ไขไม่สำเร็จ");
        return;
      }
      // Refresh record
      const data = await res.json();
      setRecord(data.record || updatedRecord);
      setIsEditing(false);
      setEditableRecord(null);
      alert("บันทึกการแก้ไขสำเร็จ");
    } catch (err) {
      alert("เกิดข้อผิดพลาด: " + err.message);
    }
  }

  // --- Recalculate total from all item totals and update the record ---
  function recalculateRecordTotal(items) {
    const newTotal = items.reduce((sum, item) => {
      const t = parseFloat(item.total);
      return sum + (isNaN(t) ? 0 : t);
    }, 0);
    setEditableRecord((prev) => ({ ...prev, items, total: newTotal }));
  }

  return (
    <div className="p-6 border rounded-md max-w-4xl mx-auto">
      <button
        onClick={() => router.push("/admin/report/daily")}
        className="mb-4 text-blue-600 hover:underline"
      >
        ← กลับ
      </button>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">รายละเอียดรายการ</h1>
        <div className="space-x-2">
          <button
            onClick={() => {
              const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
              const docNumber = record.docNumber;
              const total = record.total;
              window.open(
                `${base}/printreceipt?docNumber=${docNumber}&total=${total}`,
                "_blank",
                "width=500,height=400"
              );
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            พิมพ์บิล
          </button>
          <button
            type="button"
            onClick={() => {
              console.log("👆 กดปุ่มลบ");
              handleDelete();
            }}
            disabled={isDeleting}
            className={`bg-red-600 text-white px-4 py-2 rounded ${
              isDeleting ? "opacity-50 cursor-not-allowed" : "hover:bg-red-700"
            }`}
          >
            ลบรายการ
          </button>
        </div>
      </div>

      {/* Edit button */}
      <div className="mb-4">
        {!isEditing && (
          <button
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            onClick={handleEditClick}
          >
            แก้ไขเวลา / ประเภท / รายการ
          </button>
        )}
      </div>

      <div className="border p-4 mb-6 space-y-1 text-left">
        <p>
          <strong>เลขที่รายการ:</strong>{" "}
          {isEditing ? (
            <input
              type="text"
              value={editableRecord.docNumber}
              onChange={e =>
                setEditableRecord({ ...editableRecord, docNumber: e.target.value })
              }
              className="border rounded px-2 py-1"
              style={{ minWidth: 120 }}
            />
          ) : (
            record.docNumber
          )}
        </p>
        <p>
          <strong>ประเภท:</strong>{" "}
          {isEditing ? (
            <select
              value={editableRecord.payType}
              onChange={e =>
                setEditableRecord({ ...editableRecord, payType: e.target.value })
              }
              className="border rounded px-2 py-1"
            >
              {payTypeOptions.map(opt => (
                <option value={opt} key={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : (
            record.payType
          )}
        </p>
        <p>
          <strong>วันที่:</strong>{" "}
          {isEditing ? (
            <>
              <span>
                {new Date(editableRecord.createdAt).toLocaleDateString("th-TH", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </span>
              {" เวลา "}
              <input
                type="time"
                value={editableRecord.timeOnly}
                onChange={e => {
                  const [h, m] = e.target.value.split(":");
                  const oldDate = new Date(editableRecord.createdAt);
                  const updatedDate = new Date(
                    oldDate.getFullYear(),
                    oldDate.getMonth(),
                    oldDate.getDate(),
                    Number(h),
                    Number(m),
                    0,
                    0
                  );
                  setEditableRecord({
                    ...editableRecord,
                    createdAt: updatedDate.toISOString(),
                    timeOnly: e.target.value,
                  });
                }}
                className="border rounded px-2 py-1"
                style={{ minWidth: 90 }}
              />
            </>
          ) : (
            formattedDate
          )}
        </p>
        <p><strong>พนักงาน:</strong> {record.employee}</p>
        <p><strong>กะ:</strong> {record.shiftNo}</p>
        <p>
  <strong>ชื่อลูกค้า:</strong>{" "}
  {isEditing ? (
    <input
      type="text"
      value={editableRecord?.customerName ?? ""}
      onChange={e =>
        setEditableRecord({ ...editableRecord, customerName: e.target.value })
      }
      className="border rounded px-2 py-1"
      style={{ minWidth: 160 }}
    />
  ) : (
    record.customerName
  )}
</p>
        <p>
          <strong>ลูกค้าจ่ายเงินเป็น:</strong>{" "}
          {isEditing ? (
            <select
              value={editableRecord.payMethod}
              onChange={e =>
                setEditableRecord({ ...editableRecord, payMethod: e.target.value })
              }
              className="border rounded px-2 py-1"
            >
              <option value="cash">cash</option>
              <option value="transfer">transfer</option>
            </select>
          ) : (
            record.payMethod
          )}
        </p>
        <p>
          <strong>ลูกค้ารับเงินเป็น:</strong>{" "}
          {isEditing ? (
            <select
              value={editableRecord.receiveMethod}
              onChange={e =>
                setEditableRecord({ ...editableRecord, receiveMethod: e.target.value })
              }
              className="border rounded px-2 py-1"
            >
              <option value="cash">cash</option>
              <option value="transfer">transfer</option>
            </select>
          ) : (
            record.receiveMethod
          )}
        </p>
      </div>

      <div className="mt-6 bg-yellow-100 text-yellow-900 text-lg font-bold p-4 rounded-md shadow-md max-w-max">
        <p>
          <strong>จำนวนรวมทั้งหมด:</strong>{" "}
          {(isEditing ? editableRecord?.total : record?.total)?.toLocaleString("th-TH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }) ?? "-"}
        </p>
      </div>

      <h2 className="text-xl font-semibold mb-2">รายการ</h2>
      <table className="min-w-full border border-gray-300 rounded-md" cellPadding="5" cellSpacing="0">
        <thead className="bg-gray-100 border-b border-gray-300">
          <tr>
            <th className="border-r border-gray-300 px-3 py-2 text-left">Currency</th>
            <th className="border-r border-gray-300 px-3 py-2 text-left">Unit</th>
            <th className="border-r border-gray-300 px-3 py-2 text-left">Rate</th>
            <th className="border-r border-gray-300 px-3 py-2 text-left">Amount</th>
            <th className="px-3 py-2 text-left">Total</th>
          </tr>
        </thead>
        <tbody>
          {isEditing
            ? editableRecord.items && editableRecord.items.length > 0
              ? (
                  <>
                    {editableRecord.items.map((item, index) => (
                      <tr key={index} className="even:bg-gray-50">
                        <td className="border-r border-gray-300 px-3 py-2">
                          <input
                            type="text"
                            value={item.currency}
                            onChange={e => {
                              const newItems = editableRecord.items.map((it, idx) =>
                                idx === index ? { ...it, currency: e.target.value } : it
                              );
                              setEditableRecord({ ...editableRecord, items: newItems });
                            }}
                            className="border rounded px-2 py-1"
                            style={{ minWidth: 60 }}
                          />
                        </td>
                        {/* <td className="border-r border-gray-300 px-3 py-2">
                          <input
                            type="number"
                            value={item.unit}
                            onChange={e => {
                              const newUnit = e.target.value;
                              const newItems = editableRecord.items.map((it, idx) => {
                                if (idx === index) {
                                  const unit = parseFloat(newUnit) || 0;
                                  const rate = parseFloat(it.rate) || 0;
                                  const total = unit * rate;
                                  return { ...it, unit: newUnit, total };
                                }
                                return it;
                              });
                              setEditableRecord({ ...editableRecord, items: newItems });
                            }}
                            className="border rounded px-2 py-1"
                            style={{ minWidth: 50 }}
                          />
                        </td> */}
                        <td className="border-r border-gray-300 px-3 py-2">
                          <input
                            type="text"
                            value={item.unit ?? ""}
                            onChange={e => {
                              const newItems = editableRecord.items.map((it, idx) =>
                                idx === index ? { ...it, unit: e.target.value } : it
                              );
                              setEditableRecord({ ...editableRecord, items: newItems });
                            }}
                            className="border rounded px-2 py-1"
                            style={{ minWidth: 50 }}
                          />
                        </td>
                        <td className="border-r border-gray-300 px-3 py-2">
                          <input
                            type="number"
                            value={item.rate ?? ""}
                            step="0.01"
                            onChange={e => {
                              const newRate = e.target.value;
                              const newItems = editableRecord.items.map((it, idx) => {
                                if (idx === index) {
                                  const amount = parseFloat(it.amount) || 0;
                                  const rate = parseFloat(newRate) || 0;
                                  const total = amount * rate;
                                  return { ...it, rate: newRate, total };
                                }
                                return it;
                              });
                              recalculateRecordTotal(newItems);
                            }}
                            className="border rounded px-2 py-1"
                            style={{ minWidth: 60 }}
                          />
                        </td>
                        <td className="border-r border-gray-300 px-3 py-2">
                          <input
                            type="number"
                            value={item.amount ?? ""}
                            step="0.01"
                            onChange={e => {
                              const newAmount = e.target.value;
                              const newItems = editableRecord.items.map((it, idx) => {
                                if (idx === index) {
                                  const amount = parseFloat(newAmount) || 0;
                                  const rate = parseFloat(it.rate) || 0;
                                  const total = amount * rate;
                                  return { ...it, amount: newAmount, total };
                                }
                                return it;
                              });
                              recalculateRecordTotal(newItems);
                            }}
                            className="border rounded px-2 py-1"
                            style={{ minWidth: 60 }}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={item.total ?? ""}
                            step="0.01"
                            onChange={e => {
                              const newItems = editableRecord.items.map((it, idx) =>
                                idx === index ? { ...it, total: e.target.value } : it
                              );
                              recalculateRecordTotal(newItems);
                            }}
                            className="border rounded px-2 py-1"
                            style={{ minWidth: 60 }}
                          />
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan="5" className="p-2 text-center">
                        <button
                          className="text-sm bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
                          onClick={() => {
                            const newItems = [
                              ...editableRecord.items,
                              { currency: "", unit: "", rate: "", amount: "", total: "" },
                            ];
                            setEditableRecord({ ...editableRecord, items: newItems });
                          }}
                        >
                          + เพิ่มรายการ
                        </button>
                      </td>
                    </tr>
                  </>
                )
              : (
                <tr>
                  <td colSpan="5" className="text-center p-4">No items found.</td>
                </tr>
              )
            : record.items && record.items.length > 0 ? (
              record.items.map((item, index) => (
                <tr key={index} className="even:bg-gray-50">
                  <td className="border-r border-gray-300 px-3 py-2">{item.currency}</td>
                  <td className="border-r border-gray-300 px-3 py-2">
                    {item.unit ?? "-"}
                  </td>
                  <td className="border-r border-gray-300 px-3 py-2">
                    {item.rate != null ? item.rate.toLocaleString("th-TH", { minimumFractionDigits: 2 }) : "-"}
                  </td>
                  <td className="border-r border-gray-300 px-3 py-2">
                    {item.amount != null ? item.amount.toLocaleString("th-TH", { minimumFractionDigits: 2 }) : "-"}
                  </td>
                  <td className="px-3 py-2">
                    {item.total != null ? item.total.toLocaleString("th-TH", { minimumFractionDigits: 2 }) : "-"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="text-center p-4">No items found.</td>
              </tr>
            )}
        </tbody>
      </table>

      <p className="mt-4"><strong>หมายเหตุ:</strong> {record.note}</p>

      {/* Save/Cancel buttons */}
      {isEditing && (
        <div className="mt-6 flex gap-2">
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            onClick={handleSaveEdit}
          >
            บันทึกการแก้ไข
          </button>
          <button
            className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
            onClick={handleCancelEdit}
            type="button"
          >
            ยกเลิก
          </button>
        </div>
      )}

      {/* ตาราง adjustment log ตาม docNumber */}
      {!isEditing && docLogData.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xl font-semibold mb-2">การปรับยอดตาม DocNumber</h2>
          <table className="min-w-full border border-gray-300 text-sm" cellPadding="5" cellSpacing="0">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="border px-3 py-2">เวลา</th>
                <th className="border px-3 py-2">สกุลเงิน</th>
                <th className="border px-3 py-2">จำนวน</th>
                <th className="border px-3 py-2">ประเภท</th>
                <th className="border px-3 py-2">พนักงาน</th>
              </tr>
            </thead>
            <tbody>
              {docLogData.map((log, index) => (
                <tr
                  key={index}
                  className={`even:bg-gray-50 ${
                    log.action === "increase"
                      ? "bg-green-100"
                      : log.action === "decrease"
                      ? "bg-red-100"
                      : ""
                  }`}
                >
                  <td className="border px-3 py-1">{new Date(log.createdAt).toLocaleTimeString("th-TH")}</td>
                  <td className="border px-3 py-1">{log.currency}</td>
                  <td className="border px-3 py-1">{log.amount?.toLocaleString("th-TH")}</td>
                  <td className="border px-3 py-1">{log.action}</td>
                  <td className="border px-3 py-1">{log.employee}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* แสดงข้อความถ้าไม่มี log และไม่อยู่ในโหมดแก้ไข */}
      {!isEditing && docLogData.length === 0 && (
        <div className="mt-4 text-sm text-gray-500 italic">ไม่มี log ที่เกี่ยวข้องกับรายการนี้</div>
      )}
    </div>
  );
}

"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

export default function Page({ params }) {
  const docNumber = params.docNumber;
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const cashUpdated = useRef(false);

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
    if (!record || !record.payType || record.total == null || !record.docNumber) {
      console.warn("⚠️ ข้อมูลไม่ครบ ไม่สามารถอัปเดตเงินสดได้", record);
      return;
    }
    console.log("🧾 record ที่จะใช้ในการอัปเดตเงิน:", record);
    cashUpdated.current = true;
    console.log("✅ เรียก updateCashOnDeleteOnly");

    const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
    try {
      let updates = [];

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

      console.log("📤 updates ที่จะส่งไป update-cash:", updates);

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
              ...update, // ส่งค่า currency, amount, action แบบแยกรายการ
            }),
          });
        }
      } else {
        console.warn("⚠️ ไม่พบข้อมูล update-cash ที่ต้องส่ง");
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
        if (record.payType === "Buying" || record.payType === "Selling") {
          const isPayCash = record.payMethod === "cash";
          const isReceiveCash = record.receiveMethod === "cash";

          if (record.payType === "Buying") {
            if (isPayCash) {
              message += `- เงินสด (THB) จะเพิ่มขึ้น ${record.total.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
            }
            if (record.items && record.items.length > 0) {
              message += `- สกุลเงินในรายการจะลดลง:\n`;
              record.items.forEach((item) => {
                message += `  * ${item.currency}: ${item.amount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
              });
            }
          } else if (record.payType === "Selling") {
            if (isReceiveCash) {
              message += `- เงินสด (THB) จะลดลง ${record.total.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
            }
            if (record.items && record.items.length > 0) {
              message += `- สกุลเงินในรายการจะเพิ่มขึ้น:\n`;
              record.items.forEach((item) => {
                message += `  * ${item.currency}: ${item.amount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
              });
            }
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
              message += `  * ${item.currency}: ${item.total != null ? item.total.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}\n`;
            });
          }
        } else if (record.payType === "withdraw") {
          if (record.items && record.items.length > 0) {
            message += `- สกุลเงินในรายการจะเพิ่มขึ้น:\n`;
            record.items.forEach((item) => {
              message += `  * ${item.currency}: ${item.total != null ? item.total.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}\n`;
            });
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

      <div className="border p-4 mb-6 space-y-1 text-left">
        <p><strong>เลขที่รายการ:</strong> {record.docNumber}</p>
        <p><strong>ประเภท:</strong> {record.payType}</p>
        <p><strong>วันที่:</strong> {formattedDate}</p>
        <p><strong>พนักงาน:</strong> {record.employee}</p>
        <p><strong>กะ:</strong> {record.shiftNo}</p>
        <p><strong>ชื่อลูกค้า:</strong> {record.customerName}</p>
        <p><strong>ลูกค้าจ่ายเงินเป็น:</strong> {record.payMethod}</p>
        <p><strong>ลูกค้ารับเงินเป็น:</strong> {record.receiveMethod}</p>
      </div>

      <div className="mt-6 bg-yellow-100 text-yellow-900 text-lg font-bold p-4 rounded-md shadow-md max-w-max">
        <p><strong>จำนวนรวมทั้งหมด:</strong> {record.total.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
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
          {record.items && record.items.length > 0 ? (
            record.items.map((item, index) => (
              <tr key={index} className="even:bg-gray-50">
                <td className="border-r border-gray-300 px-3 py-2">{item.currency}</td>
                <td className="border-r border-gray-300 px-3 py-2">{item.unit}</td>
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
    </div>
  );
}

'use client';
import React, { useState } from 'react';

export default function TempPrintPage() {
  const [docNumber, setDocNumber] = useState('');

  const handlePrint = () => {
    if (!docNumber) return alert("กรุณาใส่เลขที่รายการ");
    const base = window.location.origin;
    window.open(
      `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/receipt-copy/${docNumber}`,
      "_blank",
      "width=500,height=600"
    );
  };

  return (
    <div className="p-6">
      <h1 className="text-lg font-bold mb-4">หน้าพิมพ์ชั่วคราว</h1>
      <div className="space-y-4">
        <div>
          <label className="block mb-1">เลขที่รายการ (docNumber)</label>
          <input
            type="text"
            value={docNumber}
            onChange={(e) => setDocNumber(e.target.value)}
            className="border p-2 w-full"
            placeholder="เช่น S250531001"
          />
        </div>
        <button
          onClick={handlePrint}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          พิมพ์
        </button>
      </div>
    </div>
  );
}
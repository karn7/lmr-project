"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function PrintReceiptPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const docNumber = searchParams.get("docNumber");
  const total = searchParams.get("total");

  const totalFormatted = Number(total).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (!docNumber) {
    return <div className="p-10 text-center">ไม่พบเลขที่รายการ</div>;
  }

  return (
    <div className="p-6 text-center font-sans">
      <div className="bg-black text-green-400 text-3xl font-bold p-6 rounded mb-6">
        ยอดรวม: {totalFormatted} THB
      </div>

      <button
        className="bg-green-600 text-white px-4 py-2 rounded mb-3 w-full"
        onClick={() =>
          window.open(`/receipt/${docNumber}`, "_blank", "width=500,height=600")
        }
      >
        พิมพ์ใบเสร็จ
      </button>
      <button
        className="bg-blue-500 text-white px-4 py-2 rounded mb-3 w-full"
        onClick={() =>
          window.open(`/receipt-mini/${docNumber}`, "_blank", "width=500,height=600")
        }
      >
        พิมพ์บิลย่อ
      </button>
      <button
        className="bg-gray-600 text-white px-4 py-2 rounded w-full"
        onClick={() => {
          window.close();
          window.opener?.location.replace("/welcome");
        }}
      >
        จบรายการ
      </button>
    </div>
  );
}

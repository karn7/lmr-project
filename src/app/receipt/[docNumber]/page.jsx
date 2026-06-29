"use client";
import React from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

async function loadImageObjectUrl(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return "";

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);

  await new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = resolve;
    image.onerror = reject;
    image.src = objectUrl;
  });

  return objectUrl;
}

export default function ReceiptByDocNumberPage({ params: { docNumber } }) {
  const [record, setRecord] = useState(null);
  const [employeeSignatureSrc, setEmployeeSignatureSrc] = useState("");
  const [customerSignatureSrc, setCustomerSignatureSrc] = useState("");
  const [isLoadingSignatures, setIsLoadingSignatures] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/record/${docNumber}`);
        if (!res.ok) throw new Error("Failed to fetch record");
        const data = await res.json();
        setRecord(data.record);
      } catch (err) {
        console.error(err);
        router.push(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/error`);
      }
    };
    fetchData();
  }, [docNumber, router]);

  useEffect(() => {
    if (!record) return;

    let cancelled = false;
    const objectUrls = [];

    const loadSignatures = async () => {
      setIsLoadingSignatures(true);
      setEmployeeSignatureSrc("");
      setCustomerSignatureSrc("");

      const employeeSignatureParams = new URLSearchParams({
        employeeCode: record.employeeCode || "",
        name: record.employee || "",
      });

      const employeeSignatureUrl = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/employee-signature/image?${employeeSignatureParams.toString()}`;
      const customerSignatureUrl = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/record/${record.docNumber}/signature/image`;

      try {
        const [employeeSrc, customerSrc] = await Promise.all([
          loadImageObjectUrl(employeeSignatureUrl).catch(() => ""),
          loadImageObjectUrl(customerSignatureUrl).catch(() => ""),
        ]);

        if (employeeSrc) objectUrls.push(employeeSrc);
        if (customerSrc) objectUrls.push(customerSrc);

        if (cancelled) return;

        setEmployeeSignatureSrc(employeeSrc);
        setCustomerSignatureSrc(customerSrc);
      } finally {
        if (!cancelled) {
          setIsLoadingSignatures(false);
        }
      }
    };

    loadSignatures();

    return () => {
      cancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [record]);

  if (!record) {
    return null;
  }

  // Reduce print margins as much as possible
  // eslint-disable-next-line react/jsx-no-undef
  // Group items by currency
  const grouped = record.items.reduce((acc, item) => {
    if (!acc[item.currency]) acc[item.currency] = [];
    acc[item.currency].push(item);
    return acc;
  }, {});

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: A5 portrait;
            margin: 10mm;
          }
          body {
            margin: 0;
          }
        }
      `}</style>

      <div className="w-full flex justify-center">
      <div className="w-[148mm] max-w-[100%]">
        <div className="p-6 text-sm font-mono">
          <h1 className="text-center text-lg font-bold">EXCHANGE RECEIPT</h1>
          <p className="text-center font-bold text-base">มันนี่เมท เคอเรนซี่ เอ็กซ์เชนจ์</p>
          <p className="text-center text-xs">MoneyMate Currency Exchange</p>
          <p className="text-center text-xs">305 ม.10 ถ.มิตรภาพ ต.โพธิ์ชัย อ.เมือง จ.หนองคาย</p>
          <p className="text-center text-xs">0910608858 , 0642849169</p>
          <p className="text-center text-xs">เลขที่ใบอนุญาต : MC425670002</p>
          <hr className="my-2" />
          <div className="mb-1 text-xs">Trans No: {record.docNumber}</div>
          <div className="text-xs">Date: {new Date(record.createdAt).toLocaleString("en-US")}</div>
          <div className="text-xs">Customer Name: {record.customerName}</div>
          
          <hr className="my-2" />

          <table className="w-full text-left mb-1">
            <thead className="border-b border-black">
              <tr>
                <th className="text-xs font-medium">{record?.payType || ""}</th>
                <th className="text-xs font-medium">Amount</th>
                <th className="text-xs font-medium">Rate</th>
                <th className="text-xs font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(grouped).map(([currency, items]) => {
                const groupTotal = items.reduce((sum, i) => sum + parseFloat(i.amount), 0);
                return (
                  <React.Fragment key={currency}>
                    {items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="text-xs">{item.currency}{item.unit}</td>
                        <td className="text-xs">{Number(item.amount).toLocaleString()}</td>
                        <td className="text-xs break-all max-w-[60px]">{item.rate}</td>
                        <td className="text-xs">{Number(item.total).toLocaleString()}</td>
                      </tr>
                    ))}
                    {!["deposit", "withdraw"].includes(record?.payType) && (
                      <tr>
                        <td colSpan="4" className="text-xs font-bold">
                          {currency} = {groupTotal.toLocaleString()}
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td colSpan="4"><hr className="my-2" /></td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          {!["deposit", "withdraw"].includes(record?.payType) && (
            <div className="text-left font-bold">
              TOTAL THB: {Number(record.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          )}
          <div className="flex flex-col justify-end h-[200px]">
            <div className="mt-10 flex flex-row justify-between px-8">
              <div className="flex flex-col items-center w-1/2">
                <div className="h-32 flex items-end justify-center -mb-3 overflow-hidden">
                  {employeeSignatureSrc && (
                    <img
                      src={employeeSignatureSrc}
                      alt="Employee Signature"
                      className="max-h-32 max-w-full object-contain"
                      style={{
                        transform: "translateY(18px) scale(1.65)",
                        transformOrigin: "center bottom",
                      }}
                    />
                  )}
                </div>
                <div className="border-t border-black w-4/5" />
                <div className="mt-1 text-sm text-center">
                  <div>Issued by:</div>
                  <div>{record.employee}</div>
                </div>
              </div>
              <div className="flex flex-col items-center w-1/2">
                <div className="h-32 flex items-end justify-center -mb-3 overflow-hidden">
                  {customerSignatureSrc && (
                    <img
                      src={customerSignatureSrc}
                      alt="Customer Signature"
                      className="max-h-32 max-w-full object-contain"
                    />
                  )}
                </div>
                <div className="border-t border-black w-4/5" />
                <div className="mt-1 text-sm text-center">Customer {record.customerName}</div>
              </div>
            </div>
            <div className="mt-6 text-center text-xs italic">
              <p>กรุณาตรวจสอบจำนวนเงินให้ถูกต้อง ถือว่าลูกค้าได้ตรวจสอบและรับเงินครบถ้วนแล้ว</p>
              <p>Please verify the amount. It is deemed that the customer has checked and received the full amount.</p>
            </div>
            {record.payMethod && record.receiveMethod && (
              <div className="text-[10px] text-right mt-2">
                {(record.payMethod === "cash" ? "C" : "T") + "/" + (record.receiveMethod === "cash" ? "C" : "T")}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 print:hidden">
        <div className="max-w-3xl mx-auto flex justify-end gap-3">
          <button
            onClick={() => window.close()}
            className="px-5 py-2 rounded-lg border"
          >
            ปิด
          </button>

          <button
            onClick={() => {
              window.print();
            }}
            disabled={isLoadingSignatures}
            className="px-5 py-2 rounded-lg bg-orange-500 text-white font-semibold hover:bg-orange-600"
          >
            {isLoadingSignatures ? "กำลังโหลดลายเซ็น..." : "พิมพ์ใบเสร็จ"}
          </button>
        </div>
      </div>
    </>
  );
}

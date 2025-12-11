"use client";
import React from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ReceiptByDocNumberPage(props) {
  const { docNumber } = props.params;
  const [record, setRecord] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/record/${docNumber}`);
        if (!res.ok) throw new Error("Failed to fetch record");
        const data = await res.json();
        setRecord(data.record);
        
        setTimeout(() => {
          window.print();
          setTimeout(() => window.close(), 100);
        }, 1000);
      } catch (err) {
        console.error(err);
        router.push(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/error`);
      }
    };

    fetchData();
  }, [docNumber, router]);

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
                <div className="border-t border-black w-4/5" />
                <div className="mt-1 text-sm text-center">
                  <div>Issued by:</div>
                  <div>{record.employee}</div>
                </div>
              </div>
              <div className="flex flex-col items-center w-1/2">
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
    </>
  );
}

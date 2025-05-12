"use client";
import React from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ReceiptByDocNumberPage({ params: { docNumber } }) {
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
            window.close();
          }, 500);
      } catch (err) {
        console.error(err);
        router.push(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/error`);
      }
    };

    fetchData();
  }, [docNumber, router]);

  if (!record) {
    return <div className="p-6 text-xs font-mono">Loading...</div>;
  }

  <style jsx global>{`
    @media print {
      @page {
        margin: 1mm;
      }
      body {
        margin: 0;
      }
    }
  `}</style>

  return (
    <div className="w-full flex justify-center">
      <div className="w-[95mm]">
        <div className="p-6 text-xs font-mono">
        <div className="mb-1 text-xs">Trans No: {record.docNumber}</div>
        <div className="text-xs">Date: {new Date(record.createdAt).toLocaleString("en-US")}</div>
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
            {Object.entries(
              record.items.reduce((acc, item) => {
                if (!acc[item.currency]) acc[item.currency] = [];
                acc[item.currency].push(item);
                return acc;
              }, {})
            ).map(([currency, items]) => {
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
      </div>
    </div>
  </div>
  );
}

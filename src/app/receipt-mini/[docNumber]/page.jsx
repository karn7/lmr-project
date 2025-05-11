"use client";
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
    return <div className="p-6 text-base font-mono">Loading...</div>;
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
      <div className="w-[90mm]">
        <div className="p-6 text-base font-mono">
        <div className="mb-1 text-base">Trans No: {record.docNumber}</div>
        <div className="text-base">Date: {new Date(record.createdAt).toLocaleString("en-US")}</div>
        <hr className="my-2" />
        <table className="w-full text-left">
          <thead className="border-b border-black">
            <tr>
              <th className="text-base font-bold">{record?.payType || "Currency"}</th>
              <th className="text-base font-medium">Amount</th>
              <th className="text-base font-medium">Rate</th>
              <th className="text-base font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {record.items.map((item, index) => (
              <tr key={index}>
                <td className="text-base">{item.currency}{item.unit}</td>
                <td className="text-base">{Number(item.amount).toLocaleString()}</td>
                <td className="text-base">{Number(item.rate).toFixed(2)}</td>
                <td className="text-base">{Number(item.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <hr className="my-2" />
        <div className="text-right font-bold">TOTAL THB: {Number(record.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
      </div>
    </div>
  </div>
  );
}

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
    return <div className="p-6 text-xl font-mono">Loading...</div>;
  }

  return (
    <div className="w-[100mm]">
      <div className="p-6 text-xl font-mono">
        <div className="mb-1 text-xl">Trans No: {record.docNumber}</div>
        <div className="text-xl">Date: {new Date(record.createdAt).toLocaleString("en-US")}</div>
        <hr className="my-2" />
        <table className="w-full text-left">
          <thead className="border-b border-black">
            <tr>
              <th className="text-xl font-bold">{record?.payType || "Currency"}</th>
              <th className="text-xl font-medium">Amount</th>
              <th className="text-xl font-medium">Rate</th>
              <th className="text-xl font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {record.items.map((item, index) => (
              <tr key={index}>
                <td className="text-xl">{item.currency}{item.unit}</td>
                <td className="text-xl">{Number(item.amount).toLocaleString()}</td>
                <td className="text-xl">{Number(item.rate).toFixed(2)}</td>
                <td className="text-xl">{Number(item.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <hr className="my-2" />
        <div className="text-right font-bold">TOTAL THB: {Number(record.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
      </div>
    </div>
  );
}

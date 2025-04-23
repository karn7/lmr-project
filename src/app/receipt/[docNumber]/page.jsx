"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ReceiptByDocNumberPage({ params: { docNumber } }) {
  const [record, setRecord] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/record/${docNumber}`);
        if (!res.ok) throw new Error("Failed to fetch record");
        const data = await res.json();
        setRecord(data.record);
        
        setTimeout(() => {
          window.print();
          window.close();
        }, 500);
      } catch (err) {
        console.error(err);
        router.push("/error");
      }
    };

    fetchData();
  }, [docNumber, router]);

  if (!record) {
    return <div className="p-6 text-sm font-mono">Loading...</div>;
  }

  return (
    <div className="w-[80mm]">
      <div className="p-6 text-sm font-mono">
        <div className="text-center mb-2">
          <img src="/logo.png" alt="Company Logo" className="mx-auto w-20 h-auto" />
        </div>
        <h1 className="text-center text-lg font-bold">EXCHANGE RECEIPT</h1>
        <p className="text-center font-bold text-base">มันนี่เมท เคอเรนซี่ เอ็กซ์เชนจ์</p>
        <p className="text-center text-xs">305 ม.10 ถ.มิตรภาพ ต.โพธิ์ชัย อ.เมือง จ.หนองคาย</p>
        <p className="text-center text-xs">0910608858 , 0642849169</p>
        <p className="text-center text-xs">เลขที่ใบอนุญาติ : MC425670002</p>
        <hr className="my-2" />
        <div className="mb-1 text-xs">Trans No: {record.docNumber}</div>
        <div className="text-xs">Date: {new Date(record.createdAt).toLocaleString("en-US")}</div>
        <div className="text-xs">Customer Name: {record.customerName}</div>
        <hr className="my-2" />
        <table className="w-full text-left">
          <thead className="border-b border-black">
            <tr>
              <th className="text-xs font-bold">{record?.payType || "Currency"}</th>
              <th className="text-xs font-medium">Amount</th>
              <th className="text-xs font-medium">Rate</th>
              <th className="text-xs font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {record.items.map((item, index) => (
              <tr key={index}>
                <td className="text-xs">{item.currency}{item.unit}</td>
                <td className="text-xs">{Number(item.amount).toLocaleString()}</td>
                <td className="text-xs">{Number(item.rate).toFixed(2)}</td>
                <td className="text-xs">{Number(item.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <hr className="my-2" />
        <div className="text-right font-bold">TOTAL THB: {Number(record.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
        <div className="mt-10 flex flex-col items-center">
          <div className="border-t border-black w-1/2" />
          <div className="mt-2 text-sm text-center">
            Issued by: {record.employee}
          </div>
          <div className="mt-10 border-t border-black w-1/2" />
          <div className="mt-2 text-sm text-center">
            Customer {record.customerName}
          </div>
        </div>
        
        <div className="mt-6 text-center text-xs italic">
          เอกสารใช้ในการแลกเปลี่ยนเงินตราเท่านั้น
        </div>
      </div>
    </div>
  );
}

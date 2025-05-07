 "use client";
 
 import { useParams } from "next/navigation";
 import { useEffect, useState } from "react";
 
 export default function SummaryPage() {
   const { id } = useParams();
 
   const [data, setData] = useState(null);
   const [calculation, setCalculation] = useState({});
   const [error, setError] = useState("");
 
   useEffect(() => {
     const fetchData = async () => {
       try {
         const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/shift-summary?id=${id}`);
         const result = await res.json();
         if (res.ok) {
           console.log("✅ API result", result);
           setData(result);
           const cal = {};
           if (result.cashBalance && result.closeAmount) {
             for (const cur in result.cashBalance) {
               const open = Number(result.cashBalance[cur]);
               const close = Number(result.closeAmount[cur] || 0);
               cal[cur] = close - open;
             }
           }
           setCalculation(cal);
         } else {
           setError(result.message || "ไม่สามารถโหลดข้อมูลได้");
         }
       } catch (err) {
         console.error("Error loading summary:", err);
         setError("เกิดข้อผิดพลาดในการดึงข้อมูล");
       }
     };
 
     if (id) fetchData();
   }, [id]);
 
   if (error) return <div className="p-6 text-red-500">{error}</div>;
   if (!data) return <div className="p-6">กำลังโหลด...</div>;
 
   return (
     <div className="max-w-3xl mx-auto p-6 bg-white shadow rounded">
       <h1 className="text-xl font-bold mb-4">สรุปผลการเปิด-ปิดร้าน</h1>
       {!data.closeAmount && (
  <div className="mb-4 p-3 bg-yellow-100 border border-yellow-300 text-yellow-800 rounded">
    ⚠️ รอบนี้ยังไม่ทำการปิดร้าน
  </div>
)}
       <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
         <div>📅 วันที่: <strong>{data.date}</strong></div>
         <div>🕘 รอบที่: <strong>{data.shiftNo}</strong></div>
         <div>🏪 สาขา: <strong>{data.branch}</strong></div>
         <div>👤 พนักงาน: <strong>{data.employee}</strong></div>
       </div>
 
       <table className="w-full text-left border">
         <thead className="bg-gray-100">
           <tr>
             <th className="p-2 border">สกุลเงิน</th>
             <th className="p-2 border">ยอดเปิดร้าน</th>
             <th className="p-2 border">ยอดคงเหลือในระบบ</th>
             <th className="p-2 border">ยอดปิดร้าน</th>
             <th className="p-2 border">ส่วนต่าง</th>
           </tr>
         </thead>
         <tbody>
           {Object.keys(data.cashBalance).map((cur) => {
             const diff = calculation[cur] || 0;
             let color = "text-green-600";
             if (diff < 0) color = "text-red-600";
             else if (diff > 0) color = "text-yellow-600";
             return (
               <tr key={cur}>
                 <td className="p-2 border">{cur}</td>
                 <td className="p-2 border">{Number(data.openAmount?.[cur] || 0).toLocaleString()}</td>
                 <td className="p-2 border">{Number(data.cashBalance[cur]).toLocaleString()}</td>
                 <td className="p-2 border">{Number(data.closeAmount?.[cur] || 0).toLocaleString()}</td>
                 <td className={`p-2 border ${color}`}>{diff.toLocaleString()}</td>
               </tr>
             );
           })}
         </tbody>
       </table>
     </div>
   );
 }
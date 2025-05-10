"use client";

import React, { useState, useEffect } from "react";

function RateDisplayPage() {
  const [postData, setPostData] = useState([]);

  const getPosts = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/posts`, { cache: "no-store" });
      if (!res.ok) {
        throw new Error("Failed to fetch posts.");
      }
      const data = await res.json();
      setPostData(data.posts);
    } catch (error) {
      console.log("Error loading posts: ", error);
    }
  };

  useEffect(() => {
    getPosts();
    const interval = setInterval(getPosts, 15000); // Refresh every 15 sec
    return () => clearInterval(interval);
  }, []);

  const priorityOrder = ["USD", "GBP", "EUR", "CHF", "AUD", "KRW", "JPY", "MYR", "SGD", "HKD", "CNY"];
  const sortedPostData = [...postData].sort((a, b) => {
    const aPriority = priorityOrder.indexOf(a.title);
    const bPriority = priorityOrder.indexOf(b.title);
    if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
    if (aPriority !== -1) return -1;
    if (bPriority !== -1) return 1;
    return a.title.localeCompare(b.title);
  });

  const rowsPerPage = 28;
  const [page, setPage] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPage(prev => (prev + 1) % Math.ceil(sortedPostData.length / rowsPerPage));
    }, 10000); // Switch page every 10 seconds
    return () => clearInterval(interval);
  }, [sortedPostData]);

  return (
    <div className="min-h-screen bg-white p-4 text-3xl">
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-300 rounded-md">
          <thead>
            <tr className="bg-orange-500 text-white">
              <th className="py-2 px-4 border-b text-center">Currency</th>
              <th className="py-2 px-4 border-b text-center">Denomination</th>
              <th className="py-2 px-4 border-b text-center">Buying Rate</th>
              <th className="py-2 px-4 border-b text-center">Selling Rate</th>
            </tr>
          </thead>
          <tbody>
            {sortedPostData
              .filter(val => val.title !== "THB")
              .slice(page * rowsPerPage, (page + 1) * rowsPerPage)
              .map((val, index, array) => {
                const globalIndex = page * rowsPerPage + index;
                const isFirstOfGroup = globalIndex === 0 || val.title !== sortedPostData[globalIndex - 1].title;
                const groupColor = globalIndex % 2 === 0 ? "bg-orange-50" : "bg-white";
                const bgColor = isFirstOfGroup ? groupColor : "";
                return (
                  <tr key={val._id} className={`hover:bg-gray-100 ${bgColor}`}>
                    <td className="py-2 px-4 border-b text-center">
                      {isFirstOfGroup ? (
                        <div className="flex items-center gap-2">
                          <img
                            src={`/cur/${val.title.toUpperCase()}.png`}
                            alt={val.title}
                            className="w-10 h-6 object-cover border rounded"
                          />
                          {val.title}
                        </div>
                      ) : (
                        ""
                      )}
                    </td>
                    <td className="py-2 px-4 border-b text-center">{val.content}</td>
                    <td className="py-2 px-4 border-b text-center text-green-700 font-bold text-4xl">{val.buy}</td>
                    <td className="py-2 px-4 border-b text-center text-orange-600 font-bold text-4xl">{val.sell}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <div className="mt-8 text-center text-4xl leading-relaxed">
        <p className="text-red-600 font-semibold">มันนี่เมท เคอเรนซี่ เอ็กซ์เชนจ์ (ตึกไอที อัศวรรณ หนองคาย)</p>
        <p className="text-gray-700">เรารับแลกเงินมากกว่า 100 สกุล เรทดี เรทสูง แน่นอน</p>
        <p className="text-gray-700">รับแลกเงินยกเลิกใช้ เงินชำรุด ขาดมีรอยหมึก ทุกแบบ เรทตามสภาพ</p>
      </div>
    </div>
  );
}

export default RateDisplayPage;

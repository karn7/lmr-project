"use client";

import React, { useState, useEffect } from "react";

function RateDisplayPage() {
  const [postData, setPostData] = useState([]);

  const getPosts = async () => {
    try {
      const res = await fetch("/api/posts", { cache: "no-store" });
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

  const priorityOrder = ["USD", "GBP", "EUR"];
  const sortedPostData = [...postData].sort((a, b) => {
    const aPriority = priorityOrder.indexOf(a.title);
    const bPriority = priorityOrder.indexOf(b.title);
    if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
    if (aPriority !== -1) return -1;
    if (bPriority !== -1) return 1;
    return a.title.localeCompare(b.title);
  });

  return (
    <div className="min-h-screen bg-white p-4">
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
              .map((val, index, array) => {
              const isFirstOfGroup = index === 0 || val.title !== array[index - 1].title;
              const bgColor = isFirstOfGroup ? "bg-orange-50" : "";
              return (
                <tr key={val._id} className={`hover:bg-gray-100 ${bgColor}`}>
                  <td className="py-2 px-4 border-b text-center">
                    {isFirstOfGroup ? (
                      <div className="flex items-center gap-2">
                        <img
                          src={`/cur/${val.title}.png`}
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
                  <td className="py-2 px-4 border-b text-center text-green-700 font-bold">{val.buy}</td>
                  <td className="py-2 px-4 border-b text-center text-orange-600 font-bold">{val.sell}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-8 text-center text-sm leading-relaxed">
        <p className="text-red-600 font-semibold">มันนี่เมท เคอเรนซี่ เอ็กซ์เชนจ์ (ตึกไอที อัศวรรณ หนองคาย)</p>
        <p className="text-gray-700">เรารับแลกเงินมากกว่า 100 สกุล เรทดี เรทสูง แน่นอน</p>
        <p className="text-gray-700">รับแลกเงินยกเลิกใช้ เงินชำรุด ขาดมีรอยหมึก ทุกแบบ เรทตามสภาพ</p>
      </div>
    </div>
  );
}

export default RateDisplayPage;

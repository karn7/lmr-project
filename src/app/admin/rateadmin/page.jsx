"use client";

import React, { useState, useEffect } from "react";
import Navbar from "../components/AdminNav";
import Footer from "../components/Footer";
import Link from "next/link";
import Image from "next/image";
import Container from "../components/Container";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import DeleteBtn from "./DeleteBtn";
import AdminLayout from "../components/AdminLayout";

function RatethaiPage() {
  const { data: session } = useSession();
  if (!session) redirect(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/login`);
  console.log(session);

  if (session?.user?.role !== "admin") redirect(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/`);

  const [postData, setPostData] = useState([]);
  const [expandedRow, setExpandedRow] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const getPosts = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/posts`, {
        cache: "no-store",
      });

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
  }, []);
  const priorityOrder = ["USD", "GBP", "EUR"];

  const sortedPostData = [...postData].sort((a, b) => {
    const aPriority = priorityOrder.indexOf(a.title);
    const bPriority = priorityOrder.indexOf(b.title);

    if (aPriority !== -1 && bPriority !== -1) {
      return aPriority - bPriority;
    }

    if (aPriority !== -1) return -1;
    if (bPriority !== -1) return 1;

    return a.title.localeCompare(b.title);
  });
  const filteredData = sortedPostData.filter((item) =>
    item.title.toUpperCase().includes(searchTerm)
  );
  return (
    <Container>
      <div className="hidden md:block">
        <Navbar session={session} />
      </div>
      <div className="flex-grow">
        <AdminLayout session={session}>
          <div className="bg-white shadow-md rounded-lg p-5">
            <div className="flex justify-between items-start">
              <div></div>
              <div>
                <Link
                  href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/create`}
                  className="bg-green-500 text-white py-2 px-3 rounded-md text-lg hover:bg-green-600"
                >
                  สร้างรายการใหม่
                </Link>
              </div>
            </div>

            {/* Search Bar for Mobile */}
            <div className="md:hidden mb-4">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
                placeholder="ค้นหาเช่น USD, GBP..."
                className="w-full border border-gray-300 rounded-md p-2"
              />
            </div>

            <div className="mt-5">
              {postData && postData.length > 0 ? (
                <>
                  {/* Desktop Table */}
                  <div className="overflow-x-auto hidden md:table">
                    <table className="min-w-full bg-white border border-gray-300 rounded-md">
                      <thead>
                        <tr className="bg-gray-100 text-left">
                          <th className="py-2 px-4 border-b">สกุลเงิน</th>
                          <th className="py-2 px-4 border-b">หน่วย</th>
                          <th className="py-2 px-4 border-b">เรทซื้อ</th>
                          <th className="py-2 px-4 border-b">เรทขาย</th>
                          <th className="py-2 px-4 border-b">เรทซื้อลาว</th>
                          <th className="py-2 px-4 border-b">เรทขายลาว</th>
                          <th className="py-2 px-4 border-b">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedPostData.map((val, index, array) => {
                          const isFirstOfGroup =
                            index === 0 ||
                            val.title !== array[index - 1].title;
                          return (
                            <tr key={val._id} className="hover:bg-gray-50">
                              <td className="py-2 px-4 border-b">
                                {isFirstOfGroup ? (
                                  <div className="flex items-center gap-2">
                                    <img
                                      src={`/cur/${val.title.toUpperCase()}.png`}
                                      alt={val.title}
                                      className="w-8 h-5 object-cover border rounded"
                                    />
                                    {val.title}
                                  </div>
                                ) : (
                                  ""
                                )}
                              </td>
                              <td className="py-2 px-4 border-b">
                                {val.content}
                              </td>
                              <td className="py-2 px-4 border-b">
                                {val.buy}
                              </td>
                              <td className="py-2 px-4 border-b">
                                {val.sell}
                              </td>
                              <td className="py-2 px-4 border-b">
                                {val.buylaos}
                              </td>
                              <td className="py-2 px-4 border-b">
                                {val.selllaos}
                              </td>
                              <td className="py-2 px-4 border-b space-x-2">
                                <Link
                                  href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/admin/editrate/${val._id}`}
                                  className="bg-gray-500 text-white py-1 px-2 rounded-md text-sm"
                                >
                                  Edit
                                </Link>
                                <DeleteBtn id={val._id} className="bg-red-600 text-white px-2 py-1 rounded text-xs" />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {/* Mobile View */}
                  <div className="md:hidden space-y-6">
                    {Object.entries(
                      filteredData.reduce((acc, curr) => {
                        if (!acc[curr.title]) acc[curr.title] = [];
                        acc[curr.title].push(curr);
                        return acc;
                      }, {})
                    ).map(([currency, items]) => (
                      <div key={currency}>
                        {/* หัวข้อสกุลเงิน */}
                        <div className="flex items-center gap-2 mb-2">
                          <img
                            src={`/cur/${currency.toUpperCase()}.png`}
                            alt={currency}
                            className="w-8 h-5 object-cover border rounded"
                          />
                          <span className="font-semibold text-lg">{currency}</span>
                        </div>

                        {/* รายการแต่ละหน่วย */}
                        <div className="space-y-3">
                          {items.map((val) => (
                            <div
                              key={val._id}
                              className="border rounded p-4 shadow"
                              onClick={() => setExpandedRow(expandedRow === val._id ? null : val._id)}
                            >
                              <div><strong>หน่วย:</strong> {val.content}</div>
                              <div><strong>เรทซื้อ:</strong> {val.buy}</div>
                              <div><strong>เรทขาย:</strong> {val.sell}</div>
                              <div><strong>เรทซื้อลาว:</strong> {val.buylaos}</div>
                              <div><strong>เรทขายลาว:</strong> {val.selllaos}</div>
                              {expandedRow === val._id && (
                                <div className="flex gap-2 mt-3">
                                  <Link
                                    href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/admin/editrate/${val._id}`}
                                    className="bg-gray-500 text-white px-3 py-1 rounded text-sm"
                                  >
                                    Edit
                                  </Link>
                                  <DeleteBtn
                                    id={val._id}
                                    className="bg-red-600 text-white px-2 py-1 rounded text-xs"
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="bg-gray-200 text-gray-700 p-3 rounded-md">
                  ไม่พบข้อมูล.
                </p>
              )}
            </div>
          </div>
        </AdminLayout>
      </div>
      <Footer />
    </Container>
  );
}

export default RatethaiPage;

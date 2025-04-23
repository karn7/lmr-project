"use client";

import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import UserSideNav from "../components/userSideNav";
import Link from "next/link";
import Image from "next/image";
import Container from "../components/Container";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";

function RatethaiPage() {
  const { data: session } = useSession();
  if (!session) redirect("/login");
  console.log(session);

  if (session?.user?.role === "admin") redirect("/admin/rateadmin");

  const [postData, setPostData] = useState([]);

  const getPosts = async () => {
    try {
      const res = await fetch("/api/posts", {
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
  return (
    <Container>
      <Navbar session={session} />
      <div className="flex-grow">
        <div className="container mx-auto my-10 px-5">
          <div className="flex gap-8">
            <div className="w-64 flex-shrink-0">
              <UserSideNav />
            </div>
            <div className="w-3/4 bg-white shadow-md rounded-lg p-5">
              <div className="flex justify-between items-start">
                <div></div>
                <div>
                </div>
              </div>

              <div className="mt-5">
                {postData && postData.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border border-gray-300 rounded-md">
                      <thead>
                        <tr className="bg-gray-100 text-left">
                          <th className="py-2 px-4 border-b">สกุลเงิน</th>
                          <th className="py-2 px-4 border-b">หน่วย</th>
                          <th className="py-2 px-4 border-b">เรทซื้อ</th>
                          <th className="py-2 px-4 border-b">เรทขาย</th>
                          <th className="py-2 px-4 border-b">จัดการ</th>
                        </tr>
                      </thead>

                      <tbody>
                        {sortedPostData
                          .filter((val) => val.title !== "THB")
                          .map((val, index, array) => {
                            const isFirstOfGroup =
                              index === 0 ||
                              val.title !== array[index - 1].title;

                            return (
                              <tr key={val._id} className="hover:bg-gray-50">
                                <td className="py-2 px-4 border-b">
                                  {isFirstOfGroup ? (
                                    <div className="flex items-center gap-2">
                                      <img
                                        src={`/cur/${val.title}.png`}
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
                                <td className="py-2 px-4 border-b space-x-2">
                                  <Link
                                    href={`/edit/${val._id}`}
                                    className="bg-gray-500 text-white py-1 px-2 rounded-md text-sm"
                                  >
                                    Edit
                                  </Link>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="bg-gray-200 text-gray-700 p-3 rounded-md">
                    ไม่พบข้อมูล.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </Container>
  );
}

export default RatethaiPage;

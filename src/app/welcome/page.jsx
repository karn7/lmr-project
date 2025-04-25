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
import DeleteBtn from "./DeleteBtn";
import { format } from "date-fns";

function WelcomePage() {
  const { data: session } = useSession();
  if (!session) redirect(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/login`);
  console.log(session);

  if (session?.user?.role === "admin") redirect(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/admin`);

  const [postData, setPostData] = useState([]);
  const [records, setRecords] = useState([]);

  const userEmail = session?.user?.email;

  const getPosts = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/posts?email=${userEmail}`, {
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

  const getRecords = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/record`);
      const data = await res.json();
      const today = new Date().toISOString().slice(0, 10);
      const todayRecords = data.records.filter((r) => {
        const created = new Date(r.createdAt).toISOString().slice(0, 10);
        return created === today && r.employee === session?.user?.name;
      });
      todayRecords.sort((a, b) => a.docNumber.localeCompare(b.docNumber));
      setRecords(todayRecords);
    } catch (error) {
      console.error("Error fetching records:", error);
    }
  };

  useEffect(() => {
    getPosts();
    getRecords();
  }, []);

  return (
    <Container>
      <Navbar session={session} />
      <div className="flex-grow">
        <div className="container mx-auto my-10 px-5">
          <div className="flex gap-8">
            <div className="w-64 flex-shrink-0">
              <UserSideNav />
            </div>
            <div className="flex-1 bg-white shadow-md rounded-lg p-5">
              <div className="flex justify-between items-start"></div>

              <div className="flex gap-4 mb-6">
                <Link href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/buying`}>
                  <button className="bg-green-500 text-white py-2 px-3 rounded-md text-lg hover:bg-green-600">
                    Buy
                  </button>
                </Link>

                <Link href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/selling`}>
                  <button className="bg-green-500 text-white py-2 px-3 rounded-md text-lg hover:bg-green-600">
                    Sell
                  </button>
                </Link>

                <Link href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/wechat`}>
                  <button className="bg-blue-500 text-white py-2 px-3 rounded-md text-lg hover:bg-blue-600">
                    Wechat
                  </button>
                </Link>

                <Link href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/withdraw`}>
                  <button className="bg-blue-500 text-white py-2 px-3 rounded-md text-lg hover:bg-blue-600">
                  Withdraw
                  </button>
                </Link>

                <Link href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/lot`}>
                  <button className="bg-purple-500 text-white py-2 px-3 rounded-md text-lg hover:bg-purple-600">
                    Lot
                  </button>
                </Link>
              </div>

              <table className="w-full border">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border px-3 py-2">เลขที่รายการ</th>
                    <th className="border px-3 py-2">เวลา</th>
                    <th className="border px-3 py-2">ยอดรวม</th>
                    <th className="border px-3 py-2">ประเภท</th>
                    <th className="border px-3 py-2">พิมพ์</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record, index) => (
                    <tr key={index} className={`text-center ${
                      record.payType === "Buying" ? "text-green-600" :
                      record.payType === "Selling" ? "text-orange-500" : "text-black"
                    }`}>
                      <td className="border px-3 py-1">{record.docNumber}</td>
                      <td className="border px-3 py-1">
                        {format(new Date(record.createdAt), "HH:mm:ss")}
                      </td>
                      <td className="border px-3 py-1">
                        {Number(record.total).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="border px-3 py-1">{record.payType}</td>
                      <td className="border px-3 py-1">
                        <button
                          onClick={() =>
                            window.open(
                              `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/printreceipt?docNumber=${record.docNumber}&total=${record.total}`,
                              "_blank", "width=500,height=400"
                            )
                          }
                          className="bg-gray-800 text-white px-3 py-1 rounded hover:bg-gray-700 text-sm"
                        >
                          Print
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </Container>
  );
}

export default WelcomePage;

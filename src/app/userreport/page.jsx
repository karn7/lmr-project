"use client";

import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import UserSideNav from "../components/userSideNav";
import Link from "next/link";
import Image from "next/image";
import Container from "../components/Container";
import { useSession, signOut } from "next-auth/react";
import { redirect } from "next/navigation";

function UserreportPage() {
  const { data: session } = useSession();

  useEffect(() => {
    if (!session) {
      redirect(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/login`);
    } else if (session?.user?.role === "admin") {
      redirect(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/admin`);
    }
  }, [session]);

  useEffect(() => {
    if (session?.user?.lastLoginDate) {
      const last = new Date(session.user.lastLoginDate);
      const now = new Date();

      const isNewDay = last.getFullYear() !== now.getFullYear()
                    || last.getMonth() !== now.getMonth()
                    || last.getDate() !== now.getDate();

      if (isNewDay) {
        alert("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
        signOut();
      }
    }
  }, [session]);

  const [postData, setPostData] = useState([]);
  const [records, setRecords] = useState([]);

  const [selectedDate, setSelectedDate] = useState("");
  const [selectedPayType, setSelectedPayType] = useState("Buying");
  const [loading, setLoading] = useState(false);

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

  const fetchRecords = async () => {
    if (!selectedDate) {
      alert("กรุณาเลือกวันที่");
      return;
    }
    setLoading(true);
    try {
      const query = new URLSearchParams({
        start: selectedDate,
        end: selectedDate,
        payType: selectedPayType,
      });
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/items-by-date?${query.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch records.");
      }
      const data = await res.json();
      setRecords(data.records || []);
    } catch (error) {
      console.log("Error loading records: ", error);
      setRecords([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    getPosts();
  }, []);

  const today = new Date();
  const maxDate = today.toISOString().split("T")[0];
  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() - 30);
  const minDateStr = minDate.toISOString().split("T")[0];

  return (
    <Container>
      <Navbar session={session} />
      <div className="flex-grow">
        <div className="container mx-auto my-10 px-5">
          <div className="flex gap-8">
            <div className="w-64 flex-shrink-0">
              <UserSideNav />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap gap-4 items-center mb-4">
                <label className="mr-2">
                  วันที่:{" "}
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="border rounded px-2 py-1"
                    min={minDateStr}
                    max={maxDate}
                  />
                </label>
                <label className="mr-4">
                  <input
                    type="radio"
                    name="payType"
                    value="Buying"
                    checked={selectedPayType === "Buying"}
                    onChange={() => setSelectedPayType("Buying")}
                    className="mr-1"
                  />
                  Buying
                </label>
                <label className="mr-4">
                  <input
                    type="radio"
                    name="payType"
                    value="Selling"
                    checked={selectedPayType === "Selling"}
                    onChange={() => setSelectedPayType("Selling")}
                    className="mr-1"
                  />
                  Selling
                </label>
                <button
                  onClick={fetchRecords}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  disabled={loading}
                >
                  {loading ? "กำลังโหลด..." : "ดึงข้อมูล"}
                </button>
              </div>
              <div className="mt-6 overflow-x-auto">
                {records.length > 0 ? (
                  <table className="min-w-full border border-gray-300">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border px-4 py-2 text-left">docNumber</th>
                        <th className="border px-4 py-2 text-left">currency</th>
                        <th className="border px-4 py-2 text-left">amount</th>
                        <th className="border px-4 py-2 text-left">rate</th>
                        <th className="border px-4 py-2 text-left">total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((recordGroup, groupIndex) => (
                        <React.Fragment key={groupIndex}>
                          <tr className="bg-gray-200">
                            <td className="border px-4 py-2 font-semibold" colSpan="5">
                              วันที่: {recordGroup.date}
                            </td>
                          </tr>
                          {recordGroup.items && recordGroup.items.map((record, index) => (
                            <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                              <td className="border px-4 py-2">{record.docNumber}</td>
                              <td className="border px-4 py-2">{record.currency}</td>
                              <td className="border px-4 py-2">
                                {typeof record.amount === "number"
                                  ? record.amount.toLocaleString()
                                  : record.amount}
                              </td>
                              <td className="border px-4 py-2">
                                {typeof record.rate === "number"
                                  ? record.rate.toLocaleString()
                                  : record.rate}
                              </td>
                              <td className="border px-4 py-2">
                                {typeof record.total === "number"
                                  ? record.total.toLocaleString()
                                  : record.total}
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="mt-4 text-gray-600">ไม่มีข้อมูลที่จะแสดง</p>
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

export default UserreportPage;

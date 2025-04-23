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

function WelcomePage() {
  const { data: session } = useSession();
  const [showPopup, setShowPopup] = useState(false);
  const [entryType, setEntryType] = useState("in");
  const [currency, setCurrency] = useState("THB");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [entries, setEntries] = useState([]);
  const [currentShift, setCurrentShift] = useState(null);
  const [postData, setPostData] = useState([]);

  useEffect(() => {
    if (!session) {
      redirect("/login");
    } else if (session?.user?.role === "admin") {
      redirect("/admin");
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

  const getPosts = async () => {
    try {
      const res = await fetch("/api/posts", {
        cache: "no-store",
      });
  
      if (!res.ok) {
        throw new Error("Failed to fetch posts.");
      }
  
      const data = await res.json();
      const uniquePosts = data.posts.filter(
        (post, index, self) =>
          index === self.findIndex(p => p.title === post.title)
      );
      setPostData(uniquePosts);
      console.log("📦 postData จาก API:", data.posts);
    } catch (error) {
      console.log("Error loading posts: ", error);
    }
  };

  const fetchEntries = async () => {
    if (!session?.user?.name || !currentShift?.shiftNo) return;
    console.log("🕐 ShiftNo ขณะนี้:", currentShift?.shiftNo);
    try {
      const date = new Date().toISOString().split("T")[0];
      const res = await fetch(`/api/cashdrawer?user=${session.user.name}&date=${date}&shiftNo=${currentShift.shiftNo}`);
      const data = await res.json();
      setEntries(data.entries || []);
      console.log("✅ ตรวจสอบข้อมูลที่โหลดได้:", data.entries);
      console.log("✅ Loaded entries:", data.entries);
    } catch (error) {
      console.error("Error loading entries:", error);
    }
  };

  useEffect(() => {
    const fetchCurrentShift = async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const resCheck = await fetch(`/api/open-shift/check?employee=${session?.user?.name}`);
        const dataCheck = await resCheck.json();

        if (!dataCheck.shiftNo) {
          alert("ไม่พบข้อมูลการเปิดร้าน");
          return;
        }

        setCurrentShift(dataCheck);
        console.log("📦 currentShift state:", dataCheck); // Added for debugging
      } catch (err) {
        console.error("Failed to load current shift", err);
      }
    };

    fetchCurrentShift();
  }, [session]);

  useEffect(() => {
    if (currentShift) {
      fetchEntries();
    }
  }, [currentShift]);

  useEffect(() => {
    getPosts();
  }, []);

  const handleSubmit = async () => {
    try {
      const res = await fetch("/api/cashdrawer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: entryType,
          currency,
          amount: Number(amount),
          reason,
          user: session?.user?.name,
          date: new Date().toISOString().split("T")[0],
          shiftNo: currentShift?.shiftNo,
          branch: session?.user?.branch,
        }),
      });

      if (!res.ok) throw new Error("ไม่สามารถบันทึกรายการได้");

      const data = await res.json();
      // ไม่ต้องเพิ่ม entry แบบจำลอง ให้ใช้ fetchEntries แทน
      setShowPopup(false);
      setAmount("");
      setReason("");

      let updatePayload = {
        docNumber: `CD${Date.now()}`,
        action: entryType === "in" ? "increase" : "decrease",
        shiftNo: currentShift?.shiftNo,
        employee: session?.user?.name,
      };

      if (currency === "THB") {
        updatePayload.totalTHB = Number(amount);
      } else {
        updatePayload.currency = currency;
        updatePayload.amount = Number(amount);
      }

      await fetch("/api/open-shift/update-cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      });

      alert("บันทึกข้อมูลสำเร็จ");
      fetchEntries();
    } catch (err) {
      alert("เกิดข้อผิดพลาดในการบันทึก");
      console.error(err);
    }
  };

  useEffect(() => {
    console.log("📋 postData ที่ใช้แสดงใน dropdown:", postData);
  }, [postData]);

  return (
    <Container>
      <Navbar session={session} />
      <div className="flex-grow">
        <div className="container mx-auto my-10 px-5">
          <div className="flex gap-8">
            <div className="w-64 flex-shrink-0">
              <UserSideNav />
            </div>
            <div className="flex-grow">
              <div className="mb-6">
                <h2 className="text-xl font-semibold mb-2">ข้อมูลการเปิดร้าน</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div><strong>สาขา:</strong> {session?.user?.branch}</div>
                  <div><strong>วันที่:</strong> {new Date().toLocaleDateString()}</div>
                  <div><strong>รอบที่เปิด:</strong> {currentShift?.shiftNo || "-"}</div>
                  <div><strong>พนักงาน:</strong> {session?.user?.name}</div>
                </div>
              </div>

              <div className="mb-6">
                <button onClick={() => setShowPopup(true)} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                  เพิ่มรายการ
                </button>
              </div>
              {showPopup && (
                <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
                  <div className="bg-white p-6 rounded shadow-md w-full max-w-xl">
                    <h2 className="text-lg font-bold mb-4">เพิ่มรายการเงินเข้า-ออก</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">ประเภท:</label>
                        <div className="flex items-center gap-4">
                          <label className="inline-flex items-center">
                            <input type="radio" name="type" value="in" checked={entryType === "in"} onChange={() => setEntryType("in")} className="mr-2" />
                            นำเงินเข้า
                          </label>
                          <label className="inline-flex items-center">
                            <input type="radio" name="type" value="out" checked={entryType === "out"} onChange={() => setEntryType("out")} className="mr-2" />
                            นำเงินออก
                          </label>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">สกุลเงิน:</label>
                        <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full border p-2 rounded">
                          {postData.map((item, index) => (
                            <option key={index} value={item.title}>
                              {item.title}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">จำนวน:</label>
                        <input
                          type="text"
                          value={Number(amount).toLocaleString("en-US")}
                          onChange={(e) => setAmount(e.target.value.replace(/,/g, ""))}
                          className="w-full border p-2 rounded"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium mb-1">เหตุผล:</label>
                        <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="w-full border p-2 rounded" rows={2}></textarea>
                      </div>
                      <div className="md:col-span-2 flex justify-end gap-2">
                        <button onClick={() => setShowPopup(false)} className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">ยกเลิก</button>
                        <button onClick={handleSubmit} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                          บันทึกรายการ
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="mb-6">
                <h2 className="text-xl font-semibold mb-2">รายการที่เพิ่มวันนี้</h2>
                <p className="text-sm text-gray-500 mb-2">โหลด {entries.length} รายการ</p>
                <table className="w-full border">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border px-4 py-2">ประเภท</th>
                      <th className="border px-4 py-2">จำนวน</th>
                      <th className="border px-4 py-2">สกุลเงิน</th>
                      <th className="border px-4 py-2">เหตุผล</th>
                    </tr>
                  </thead>
                  <tbody>
                    {console.log("📋 Entries to render:", entries)}
                    {entries.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="text-center py-4">ยังไม่มีรายการ</td>
                      </tr>
                    ) : (
                      entries.map((entry, index) => {
                        console.log("🔍 แต่ละรายการ:", entry); // Added for debugging individual entries
                        return (
                          <tr key={index}>
                            <td className="border px-4 py-2">
                              {entry.type === "in" ? "นำเงินเข้า" : "นำเงินออก"}
                            </td>
                            <td className="border px-4 py-2">{Number(entry.amount).toLocaleString("en-US")}</td>
                            <td className="border px-4 py-2">{entry.currency}</td>
                            <td className="border px-4 py-2">{entry.reason}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </Container>
  );
}

export default WelcomePage;
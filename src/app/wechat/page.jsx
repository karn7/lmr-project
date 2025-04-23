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

  const [postData, setPostData] = useState([]);
  const [records, setRecords] = useState([]);

  const userEmail = session?.user?.email;

  const [customerName, setCustomerName] = useState("");
  const [exchangeAmount, setExchangeAmount] = useState("");
  const [totalTHB, setTotalTHB] = useState("");
  const [note, setNote] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [docNumber, setDocNumber] = useState("");

  const getPosts = async () => {
    try {
      const res = await fetch(`/api/posts`, {
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

  useEffect(() => {
    const matchedPost = postData.find(p => p.title === "CNY" && p.content === "100-50");
    const rate = parseFloat(matchedPost?.buy || "0");
    const amount = parseFloat(exchangeAmount);
    if (!isNaN(rate) && !isNaN(amount)) {
      setTotalTHB((rate * amount).toFixed(2));
    } else {
      setTotalTHB("");
    }
  }, [postData, exchangeAmount]);

  const handleSaveRecord = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              currency: "CNY",
              rate: parseFloat(postData.find(p => p.title === "CNY" && p.content === "100-50")?.buy || "0"),
              amount: parseFloat(exchangeAmount),
              total: parseFloat(totalTHB)
            }
          ],
          employee: session?.user?.name,
          branch: session?.user?.branch,
          customerName,
          payType: "Wechat",
          payMethod: "wechat",
          payMethodNote: "",
          receiveMethod: "เงินสด",
          receiveMethodNote: "",
          total: parseFloat(totalTHB),
          note
        })
      });

      const data = await res.json();
      if (res.ok) {
        setDocNumber(data.docNumber);
        alert("บันทึกรายการสำเร็จ เลขที่: " + data.docNumber);
      } else {
        alert("เกิดข้อผิดพลาด: " + data.message);
      }
    } catch (err) {
      console.error("Error saving record:", err);
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Container>
      <Navbar session={session} />
      <div className="flex-grow">
        <div className="container mx-auto my-10 px-5">
          <div className="bg-white shadow-md rounded-lg p-6 space-y-6">
            <div className="flex justify-between items-center">
              <Link href="/welcome">
                <button className="text-sm text-blue-600 hover:underline">← กลับ</button>
              </Link>
              <h2 className="text-xl font-semibold text-gray-700">WECHAT</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <label className="block font-medium">เลขที่:</label>
                <input type="text" value={docNumber || "รอการสร้าง..."} readOnly className="w-full border px-2 py-1 bg-gray-100" />
              </div>
              <div>
                <label className="block font-medium">วันที่:</label>
                <input type="text" value={new Date().toLocaleDateString("th-TH")} readOnly className="w-full border px-2 py-1 bg-gray-100" />
              </div>
              <div>
                <label className="block font-medium">พนักงาน:</label>
                <input type="text" value={session?.user?.name || ""} readOnly className="w-full border px-2 py-1 bg-gray-100" />
              </div>
              <div>
                <label className="block font-medium">ชื่อลูกค้า:</label>
                <input type="text" className="w-full border px-2 py-1" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              </div>
              <div>
                <label className="block font-medium">สาขา:</label>
                <input type="text" className="w-full border px-2 py-1 bg-gray-100" value={session?.user?.branch || ""} readOnly />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block font-medium">สกุลเงิน:</label>
                <input type="text" value="CNY" readOnly className="w-full border px-2 py-1 bg-gray-100" />
              </div>
              <div>
                <label className="block font-medium">เรท:</label>
                <input type="text" value={postData.find(p => p.title === "CNY" && p.content === "100-50")?.buy || ""} readOnly className="w-full border px-2 py-1 bg-gray-100" />
              </div>
              <div>
                <label className="block font-medium">จำนวนที่แลก:</label>
                <input
                  type="text"
                  className="w-full border px-2 py-1 text-right"
                  value={
                    exchangeAmount
                      ? parseFloat(exchangeAmount).toLocaleString("th-TH")
                      : ""
                  }
                  onChange={(e) => {
                    const raw = e.target.value.replace(/,/g, "");
                    if (/^\d*$/.test(raw)) {
                      setExchangeAmount(raw);
                    }
                  }}
                />
              </div>
            </div>

            <div>
              <label className="block font-medium">รวม (THB):</label>
              <input
                type="text"
                readOnly
                value={
                  totalTHB
                    ? parseFloat(totalTHB).toLocaleString("th-TH", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : ""
                }
                className="w-full border px-2 py-2 text-2xl bg-black text-green-400 font-bold text-right"
              />
            </div>

            {/* Extra fields for note */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="col-span-full">
                <label className="block font-medium">หมายเหตุทั่วไป:</label>
                <textarea className="w-full border px-2 py-1" value={note} onChange={(e) => setNote(e.target.value)}></textarea>
              </div>
            </div>

            <button onClick={handleSaveRecord} disabled={isSaving} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              {isSaving ? "กำลังบันทึก..." : "บันทึกรายการ"}
            </button>
          </div>
        </div>
      </div>
      <Footer />
    </Container>
  );
}

export default WelcomePage;

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import Container from "../components/Container";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

function WelcomePage() {
  const { data: session } = useSession();

  const [currentShift, setCurrentShift] = useState({});

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
        alert("ໄອດີໝົດອາຍຸ ກະລຸນາເຂົ້າລະບົບໃໝ່");
        signOut();
      }
    }
  }, [session]);

  const [postData, setPostData] = useState([]);
  const [records, setRecords] = useState([]);

  const userEmail = session?.user?.email;

  const [customerName, setCustomerName] = useState("");
  const [exchangeAmount, setExchangeAmount] = useState("");
  const [totalLAK, setTotalLAK] = useState("");
  const [note, setNote] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [docNumber, setDocNumber] = useState("");

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

  useEffect(() => {
    const fetchShift = async () => {
      if (!session?.user?.name) return;
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/open-shift/check?employee=${session.user.name}`);
      const data = await res.json();
      if (data?.shiftNo) {
        setCurrentShift(data);
      } else {
        console.warn("ບໍ່ພົບຂໍ້ມູນຮອບທີ່ເປີດຢູ່");
      }
    };
    fetchShift();
  }, [session?.user?.name]);

  useEffect(() => {
    const matchedPost = postData.find(p => p.title === "CNY" && p.content === "100-50");
    const rate = parseFloat(matchedPost?.buylaos || "0");
    const amount = parseFloat(exchangeAmount);
    if (!isNaN(rate) && !isNaN(amount)) {
      setTotalLAK((rate * amount).toFixed(2));
    } else {
      setTotalLAK("");
    }
  }, [postData, exchangeAmount]);

  const handleSaveRecord = async () => {
    if (!navigator.onLine) {
      alert("ບໍ່ສາມາດບັນທຶກໄດ້ ເນື່ອງຈາກບໍ່ມີການເຊື່ອມຕໍ່ອິນເຕີເນັດ");
      return;
    }

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
              total: parseFloat(totalLAK)
            }
          ],
          employee: session?.user?.name,
          employeeCode: session?.user?.employeeCode || "",
          branch: session?.user?.branch,
          shiftNo: currentShift?.shiftNo || "",
          customerName,
          payType: "Wechat",
          payMethod: "wechat",
          payMethodNote: "",
          receiveMethod: "เงินสด",
          receiveMethodNote: "",
          total: parseFloat(totalLAK),
          note
        })
      });

      const data = await res.json();
      if (res.ok) {
        setDocNumber(data.docNumber);

        const payloadLAK = {
          docNumber: data.docNumber,
          employee: session?.user?.name || "",
          shiftNo: currentShift?.shiftNo || "",
          totalLAK: parseFloat(totalLAK),
          action: "decrease",
        };
        console.log("📤 ส่งข้อมูล update-cash สำหรับ LAK:", payloadLAK);
        await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/open-shift/update-cash`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloadLAK),
        });

        const total = parseFloat(totalLAK).toFixed(2);
        window.open(
          `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/printreceipt?docNumber=${data.docNumber}&total=${total}`,
          "_blank",
          "width=500,height=400"
        );
      } else {
        alert("ເກີດຂໍ້ຜິດພາດ: " + data.message);
      }
    } catch (err) {
      console.error("Error saving record:", err);
      alert("ເກີດຂໍ້ຜິດພາດໃນການເຊື່ອມຕໍ່ເຊີບເວີ");
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
              <Link href="/laos/exchange">
                <button className="text-sm text-blue-600 hover:underline">← ກັບຄືນ</button>
              </Link>
              <h2 className="text-xl font-semibold text-gray-700">WECHAT</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <label className="block font-medium">ເລກທີ:</label>
                <input type="text" value={docNumber || "รอการสร้าง..."} readOnly className="w-full border px-2 py-1 bg-gray-100" />
              </div>
              <div>
                <label className="block font-medium">ວັນທີ:</label>
                <input type="text" value={new Date().toLocaleDateString("th-TH")} readOnly className="w-full border px-2 py-1 bg-gray-100" />
              </div>
              <div>
                <label className="block font-medium">ພະນັກງານ:</label>
                <input type="text" value={session?.user?.name || ""} readOnly className="w-full border px-2 py-1 bg-gray-100" />
              </div>
              <div>
                <label className="block font-medium">ຊື່ລູກຄ້າ:</label>
                <input type="text" className="w-full border px-2 py-1" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              </div>
              <div>
                <label className="block font-medium">ສາຂາ:</label>
                <input type="text" className="w-full border px-2 py-1 bg-gray-100" value={session?.user?.branch || ""} readOnly />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block font-medium">ສະກຸນເງິນ:</label>
                <input type="text" value="CNY" readOnly className="w-full border px-2 py-1 bg-gray-100" />
              </div>
              <div>
                <label className="block font-medium">ເລດ:</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={postData.find(p => p.title === "CNY" && p.content === "100-50")?.buylaos || ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const value = raw.replace(/[^0-9.]/g, "");
                    // Allow only one dot
                    const parts = value.split(".");
                    const sanitized = parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : value;

                    setPostData((prev) => {
                      const updated = [...prev];
                      const index = updated.findIndex(p => p.title === "CNY" && p.content === "100-50");
                      if (index !== -1) {
                        updated[index] = { ...updated[index], buy: sanitized };
                      }
                      return updated;
                    });
                  }}
                  className="w-full border px-2 py-1"
                />
              </div>
              <div>
                <label className="block font-medium">ຈຳນວນທີ່ແລກ:</label>
                <input
                  type="text"
                  className="w-full border px-2 py-1 text-right bg-yellow-100 text-red-700 font-semibold"
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
              <label className="block font-medium">ລວມ (LAK):</label>
              <input
                type="text"
                readOnly
                value={
                  totalLAK
                    ? parseFloat(totalLAK).toLocaleString("th-TH", {
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
                <label className="block font-medium">ໝາຍເຫດທົ່ວໄປ:</label>
                <textarea className="w-full border px-2 py-1" value={note} onChange={(e) => setNote(e.target.value)}></textarea>
              </div>
            </div>

            <button
              onClick={handleSaveRecord}
              disabled={isSaving}
              className={`bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 ${
                isSaving ? "pointer-events-none opacity-50" : ""
              }`}
            >
              {isSaving ? "ກຳລັງບັນທຶກຂໍ້ມູນ..." : "ບັນທຶກລາຍການ"}
            </button>
          </div>
        </div>
      </div>
      <Footer />
    </Container>
  );
}

export default WelcomePage;

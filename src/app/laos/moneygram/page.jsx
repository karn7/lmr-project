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
  const [usdReceiveMethod, setUsdReceiveMethod] = useState("usd");

  const [exchangeRates, setExchangeRates] = useState({ USD: 0 });
  const [usdFee, setUsdFee] = useState(0);

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

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/posts`);
        const data = await res.json();
        const rates = { USD: 0, THB: 0 };
        data.posts.forEach(post => {
          if (post.title === "USD") rates.USD = parseFloat(post.selllaos || 0);
          if (post.title === "THB") rates.THB = parseFloat(post.selllaos || 0);
        });
        setExchangeRates(rates);
      } catch (err) {
        console.error("Error fetching exchange rates", err);
      }
    };
    fetchRates();
  }, []);

  const calculateFee = (converted) => {
    const amt = parseFloat(converted || 0);
    if (amt <= 10000000) return 15000;
    else if (amt <= 15000000) return 15000;
    else if (amt <= 20000000) return 20000;
    else if (amt <= 25000000) return 25000;
    else if (amt <= 35000000) return 35000;
    else if (amt <= 45000000) return 45000;
    else if (amt <= 55000000) return 55000;
    else if (amt <= 65000000) return 65000;
    else if (amt <= 75000000) return 75000;
    else if (amt <= 85000000) return 85000;
    else if (amt <= 95000000) return 95000;
    else if (amt <= 100000000) return 105000;
    else return Math.ceil(amt * 0.00115);
  };

  const [postData, setPostData] = useState([]);
  const [records, setRecords] = useState([]);

  const userEmail = session?.user?.email;

  const [customerName, setCustomerName] = useState("");
  const [exchangeAmount, setExchangeAmount] = useState("");
  const [totalLAK, setTotalLAK] = useState("");
  const [note, setNote] = useState("");
  const [rate, setRate] = useState("");
  // คำนวณค่า totalLAK อัตโนมัติเมื่อ exchangeAmount, rate, หรือ usdReceiveMethod เปลี่ยนแปลง
  useEffect(() => {
    if (usdReceiveMethod === "lak" && exchangeAmount && rate) {
      const total = parseFloat(exchangeAmount) * parseFloat(rate);
      setTotalLAK(total.toFixed(2));
    } else {
      setTotalLAK("");
    }
  }, [exchangeAmount, rate, usdReceiveMethod]);

  useEffect(() => {
    if (usdReceiveMethod === "usd" && exchangeAmount && exchangeRates.USD) {
      const usd = parseFloat(exchangeAmount || "0");
      const converted = usd * exchangeRates.USD;
      const fee = calculateFee(converted);
      setUsdFee(fee);
    } else {
      setUsdFee(0);
    }
  }, [exchangeAmount, usdReceiveMethod, exchangeRates]);

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
        console.warn("ไม่พบข้อมูลรอบที่เปิดอยู่");
      }
    };
    fetchShift();
  }, [session?.user?.name]);

  const handleSaveRecord = async () => {
    if (!navigator.onLine) {
      alert("ไม่สามารถบันทึกข้อมูลได้ เนื่องจากไม่มีการเชื่อมต่ออินเทอร์เน็ต");
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
              currency: "USD",
              rate: parseFloat(rate),
              amount: parseFloat(exchangeAmount),
              total: usdReceiveMethod === "usd" ? parseFloat(totalLAK) : parseFloat(totalLAK)
            },
            ...(usdReceiveMethod === "usd"
              ? [
                  {
                    currency: "LAK-Fee",
                    rate: 1,
                    amount: usdFee,
                    total: usdFee
                  }
                ]
              : [])
          ],
          employee: session?.user?.name,
          employeeCode: session?.user?.employeeCode || "",
          branch: session?.user?.branch,
          shiftNo: currentShift?.shiftNo || "",
          customerName,
          payType: "MoneyGram",
          payMethod: "",
          payMethodNote: "",
          receiveMethod: "",
          receiveMethodNote: "",
          total: parseFloat(totalLAK),
          note
        })
      });

      const data = await res.json();
      if (res.ok) {
        setDocNumber(data.docNumber);

        const isUsdTransfer = usdReceiveMethod === "usd";
        const payloadLAK = {
          docNumber: data.docNumber,
          employee: session?.user?.name || "",
          shiftNo: currentShift?.shiftNo || "",
          totalLAK: isUsdTransfer ? usdFee : parseFloat(totalLAK),
          action: isUsdTransfer ? "increase" : "decrease",
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
              <Link href="/laos/exchange">
                <button className="text-sm text-blue-600 hover:underline">← ກັບຄືນ</button>
              </Link>
              <h2 className="text-xl font-semibold text-gray-700">MoneyGram</h2>
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

            <div className="grid grid-cols-1 sm:grid-cols-1 gap-4">
  <div className="grid grid-cols-1 sm:grid-cols-1">
    <div>
      <label className="block font-medium">ສະກຸນເງິນ:</label>
      <input type="text" value="USD" readOnly className="w-full border px-2 py-1 bg-gray-100" />
      <label className="block font-medium mt-2">ຈຳນວນ (USD):</label>
      <input
        type="number"
        step="0.01"
        min="0"
        value={exchangeAmount}
        onChange={(e) => {
          const raw = e.target.value;
          const value = raw.replace(/[^0-9.]/g, "");
          const parts = value.split(".");
          const sanitized = parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : value;
          setExchangeAmount(sanitized);
        }}
        className="w-full border px-2 py-1 bg-yellow-100 text-red-700 font-semibold"
      />
      <div className="mt-2 flex gap-4">
        <label className="inline-flex items-center">
          <input
            type="radio"
            name="usdReceiveMethod"
            value="usd"
            checked={usdReceiveMethod === "usd"}
            onChange={(e) => setUsdReceiveMethod(e.target.value)}
            className="form-radio text-blue-600"
          />
          <span className="ml-2">ໄດ້ຮັບໂອນເງິນ USD</span>
        </label>
        <label className="inline-flex items-center">
          <input
            type="radio"
            name="usdReceiveMethod"
            value="lak"
            checked={usdReceiveMethod === "lak"}
            onChange={(e) => setUsdReceiveMethod(e.target.value)}
            className="form-radio text-blue-600"
          />
          <span className="ml-2">ໄດ້ຮັບເງິນສົດ (LAK)</span>
        </label>
      </div>
      {usdReceiveMethod === "usd" && (
        <div className="mt-4">
          <label className="block font-medium">ຄ່າທຳນຽມ (LAK):</label>
          <input
            type="text"
            readOnly
            className="w-full border px-2 py-1 bg-gray-100"
            value={usdFee ? usdFee.toLocaleString("th-TH") : ""}
          />
        </div>
      )}
    </div>
  </div>
  {usdReceiveMethod === "lak" && (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label className="block font-medium">ອັດຕາແລກປ່ຽນ:</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={rate}
          onChange={(e) => {
            const raw = e.target.value;
            const value = raw.replace(/[^0-9.]/g, "");
            const parts = value.split(".");
            const sanitized = parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : value;
            setRate(sanitized);
          }}
          className="w-full border px-2 py-1 bg-yellow-100 text-green-600 font-semibold"
        />
      </div>
    </div>
  )}

  {usdReceiveMethod === "lak" && (
    <div>
      <label className="block font-medium">ຍອດລວມ (LAK):</label>
      <input
        type="text"
        readOnly
        value={
          totalLAK
            ? parseFloat(totalLAK).toLocaleString("th-TH", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })
            : ""
        }
        className="w-full border px-2 py-2 text-2xl bg-black text-green-400 font-bold text-right"
      />
    </div>
  )}
</div>

            {/* Extra fields for note */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="col-span-full">
                <label className="block font-medium">ໝາຍເຫດ:</label>
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

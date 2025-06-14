"use client";

import React, { useState, useEffect, useCallback } from "react";
import Container from "../components/Container";
import Navbar from "../components/Navbar";
import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import Footer from "../components/Footer";

const calculateFee = (amount, currency, smallNoteCount = 0) => {
  const amt = parseFloat(amount || "0");
  const min = currency === "LAK" ? 10000 : 15000;
  let fee = 0;
  if (amt <= 10000000) fee = min;
  else if (amt <= 15000000) fee = 15000;
  else if (amt <= 20000000) fee = 20000;
  else if (amt <= 25000000) fee = 25000;
  else if (amt <= 35000000) fee = 35000;
  else if (amt <= 45000000) fee = 45000;
  else if (amt <= 55000000) fee = 55000;
  else if (amt <= 65000000) fee = 65000;
  else if (amt <= 75000000) fee = 75000;
  else if (amt <= 85000000) fee = 85000;
  else if (amt <= 95000000) fee = 95000;
  else if (amt <= 100000000) fee = 105000;
  else fee = Math.ceil(amt * 0.00115);

  const extra = Math.ceil(parseInt(smallNoteCount || "0", 10) / 30) * 5000;
  return fee + extra;
};

function WithdrawPage() {
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
        alert("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
        signOut();
      }
    }
  }, [session]);

  const [customerName, setCustomerName] = useState("");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [docNumber, setDocNumber] = useState("");

  // New states
  const [currency, setCurrency] = useState("THB");
  const [amount, setAmount] = useState("");
  const [fee, setFee] = useState("50");
  const [transactionType, setTransactionType] = useState("withdraw");
  const [smallNoteCount, setSmallNoteCount] = useState("0");
  // New channel state
  const [channel, setChannel] = useState("NOUKKY");

  const [exchangeRates, setExchangeRates] = useState({ THB: 0, USD: 0 });

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/posts`);
        const data = await res.json();
        const rates = { THB: 0, USD: 0 };
        data.posts.forEach(post => {
          if (post.title === "THB") rates.THB = parseFloat(post.selllaos || 0);
          if (post.title === "USD") rates.USD = parseFloat(post.selllaos || 0);
        });
        setExchangeRates(rates);
      } catch (err) {
        console.error("Error fetching exchange rates", err);
      }
    };
    fetchRates();
  }, []);

  const calculateConvertedAmount = useCallback(() => {
    const amt = parseFloat(amount || "0");
    if (currency === "THB") return amt * exchangeRates.THB;
    if (currency === "USD") return amt * exchangeRates.USD;
    return amt;
  }, [amount, currency, exchangeRates]);

  useEffect(() => {
    const converted = calculateConvertedAmount();
    setFee(calculateFee(converted, currency, smallNoteCount));
  }, [amount, currency, smallNoteCount, calculateConvertedAmount]);

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
    setIsSaving(true);
    try {
      const payType = transactionType === "deposit" ? "deposit" : "withdraw";

      const items = [
        {
          currency,
          unit: payType,
          rate: "",
          amount: "",
          total: parseFloat(amount || "0"),
        },
        {
          currency: "LAK",
          unit: "Fee",
          rate: "",
          amount: "",
          total: parseFloat(fee || "0"),
        }
      ];

      const totalAmount = parseFloat(amount || "0") + parseFloat(fee || "0");

      const payload = {
        employee: session?.user?.name || "",
        employeeCode: session?.user?.employeeCode || "",
        branch: session?.user?.branch || "",
        shiftNo: currentShift.shiftNo || "",
        customerName,
        payType,
        payMethod: "cash",
        receiveMethod: "cash",
        note,
        items,
        total: totalAmount,
        ...(transactionType === "deposit"
          ? { receiveMethodNote: channel }
          : { payMethodNote: channel }),
      };

      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/record`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to save record");
      }

      const data = await res.json();
      setDocNumber(data.docNumber || "");

      // Update cash in open shift (two separate requests for deposit/withdraw and fee)
      const updateCashBase = {
        docNumber: data.docNumber || "",
        employee: session?.user?.name || "",
        shiftNo: currentShift.shiftNo || "",
      };
      if (transactionType === "deposit") {
        // 1. Deposit amount (increase)
        await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/open-shift/update-cash`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...updateCashBase,
            currency: currency,
            amount: parseFloat(amount || "0"),
            action: "increase",
          }),
        });
        // 2. Fee (increase)
        await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/open-shift/update-cash`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...updateCashBase,
            currency: "LAK",
            amount: parseFloat(fee || "0"),
            action: "increase",
          }),
        });
      } else if (transactionType === "withdraw") {
        // 1. Withdraw amount (decrease)
        await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/open-shift/update-cash`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...updateCashBase,
            currency: currency,
            amount: parseFloat(amount || "0"),
            action: "decrease",
          }),
        });
        // 2. Fee (increase)
        await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/open-shift/update-cash`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...updateCashBase,
            currency: "LAK",
            amount: parseFloat(fee || "0"),
            action: "increase",
          }),
        });
      }

      // Open print receipt window
      window.open(
        `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/printreceipt?docNumber=${data.docNumber}&total=${totalAmount}`,
        "_blank",
        "width=500,height=400"
      );

    } catch (err) {
      console.error("Error saving record:", err);
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์เวอร์");
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
                <button className="text-sm text-blue-600 hover:underline">← กลับ</button>
              </Link>
              <h2 className="text-xl font-semibold text-gray-700">ฝาก-ถอน</h2>
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

            <div className="space-y-4 text-lg font-semibold">
              <div className="flex items-center space-x-6">
                <label>ประเภทรายการ:</label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    name="transactionType"
                    value="deposit"
                    checked={transactionType === "deposit"}
                    onChange={() => setTransactionType("deposit")}
                    className="form-radio"
                  />
                  <span className="ml-1">ฝากเงิน</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    name="transactionType"
                    value="withdraw"
                    checked={transactionType === "withdraw"}
                    onChange={() => setTransactionType("withdraw")}
                    className="form-radio"
                  />
                  <span className="ml-1">ถอนเงิน</span>
                </label>
              </div>
              <div className="flex items-center space-x-4">
                <label className="font-medium">ช่องทาง:</label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    name="channel"
                    value="NOUKKY"
                    checked={channel === "NOUKKY"}
                    onChange={() => setChannel("NOUKKY")}
                    className="form-radio"
                  />
                  <span className="ml-1">NOUKKY</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    name="channel"
                    value="BECOME"
                    checked={channel === "BECOME"}
                    onChange={() => setChannel("BECOME")}
                    className="form-radio"
                  />
                  <span className="ml-1">BECOME</span>
                </label>
              </div>
            </div>

            {/* New currency, amount, fee inputs */}
            <div className="flex flex-col sm:flex-row sm:space-x-6 space-y-4 sm:space-y-0">
              <div className="flex items-center space-x-4">
                <label className="font-medium">สกุลเงิน:</label>
                <div className="flex space-x-4">
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      name="currency"
                      value="THB"
                      checked={currency === "THB"}
                      onChange={() => setCurrency("THB")}
                      className="form-radio"
                    />
                    <span className="ml-1">THB</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      name="currency"
                      value="LAK"
                      checked={currency === "LAK"}
                      onChange={() => setCurrency("LAK")}
                      className="form-radio"
                    />
                    <span className="ml-1">LAK</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      name="currency"
                      value="USD"
                      checked={currency === "USD"}
                      onChange={() => setCurrency("USD")}
                      className="form-radio"
                    />
                    <span className="ml-1">USD</span>
                  </label>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4">
                <label className="font-medium">จำนวนเงิน:</label>
                <input
                  type="text"
                  value={amount ? Number(amount).toLocaleString("th-TH") : ""}
                  onChange={(e) => {
                    const val = e.target.value.replace(/,/g, "");
                    if (!isNaN(val) || val === "") {
                      setAmount(val);
                    }
                  }}
                  onBlur={() => {
                    if (amount) {
                      setAmount(String(Number(amount)));
                    }
                  }}
                  onFocus={() => {
                    if (amount) {
                      setAmount(amount.replace(/,/g, ""));
                    }
                  }}
                  className="border px-2 py-1 w-full sm:w-40"
                  placeholder="0.00"
                />
              </div>

              <div className="flex flex-row space-x-4">
                <div className="border rounded p-3 flex flex-col">
                  <label className="font-medium">ค่าธรรมเนียม (กีบ):</label>
                  <input
                    type="text"
                    value={fee ? Number(fee).toLocaleString("th-TH") : ""}
                    readOnly
                    className="border px-2 py-1 w-full sm:w-24 bg-gray-100 text-gray-600"
                    placeholder="0"
                  />
                </div>
                {transactionType === "deposit" && (currency === "THB" || currency === "USD") && (
                  <div className="border rounded p-3 flex flex-col sm:ml-4">
                    <label className="font-medium">ใบเล็ก (จำนวนกี่ใบ):</label>
                    <input
                      type="text"
                      value={smallNoteCount}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, "");
                        setSmallNoteCount(raw);
                      }}
                      className="border px-2 py-1 w-full sm:w-24"
                      placeholder="0"
                    />
                  </div>
                )}
              </div>
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

export default WithdrawPage;

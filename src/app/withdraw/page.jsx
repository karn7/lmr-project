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
  const [feeCurrency, setFeeCurrency] = useState("THB");

  const feeCurrencyText = feeCurrency === "THB" ? "บาท" : feeCurrency === "LAK" ? "กีบ" : "ดอลลาร์";

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
      alert("ไม่มีการเชื่อมต่ออินเทอร์เน็ต กรุณาเชื่อมต่อก่อนบันทึก");
      return;
    }
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
          currency: feeCurrency,
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
            currency: feeCurrency,
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
            currency: feeCurrency,
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

            <div className="flex items-center space-x-6 text-lg font-semibold">
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

              <div className="border rounded p-3 flex flex-col">
                <label className="font-medium">ค่าธรรมเนียม ({feeCurrencyText}):</label>
                <input
                  type="number"
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                  className="border px-2 py-1 w-full sm:w-24"
                  placeholder="50"
                />
                <div className="flex space-x-4 mt-2">
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      name="feeCurrency"
                      value="THB"
                      checked={feeCurrency === "THB"}
                      onChange={() => setFeeCurrency("THB")}
                      className="form-radio"
                    />
                    <span className="ml-1">THB</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      name="feeCurrency"
                      value="LAK"
                      checked={feeCurrency === "LAK"}
                      onChange={() => setFeeCurrency("LAK")}
                      className="form-radio"
                    />
                    <span className="ml-1">LAK</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      name="feeCurrency"
                      value="USD"
                      checked={feeCurrency === "USD"}
                      onChange={() => setFeeCurrency("USD")}
                      className="form-radio"
                    />
                    <span className="ml-1">USD</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Extra fields for note */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="col-span-full">
                <label className="block font-medium">หมายเหตุทั่วไป:</label>
                <textarea className="w-full border px-2 py-1" value={note} onChange={(e) => setNote(e.target.value)}></textarea>
              </div>
            </div>

            <button
              onClick={handleSaveRecord}
              disabled={isSaving}
              className={`px-4 py-2 rounded text-white ${isSaving ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}
            >
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

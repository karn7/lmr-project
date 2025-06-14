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

function LotteryPage() {
  const { data: session } = useSession();

  const [currentShift, setCurrentShift] = useState({});
  const [isSaving, setIsSaving] = useState(false);

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

  const [docNumber, setDocNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [note, setNote] = useState("");

  // New states
  const [lotType, setLotType] = useState("สลากกินแบ่งรัฐบาล");
  const [selectedPrize, setSelectedPrize] = useState("เลขท้าย 2 ตัว");
  const [quantity, setQuantity] = useState(1);
  const [lotteryItems, setLotteryItems] = useState([]);

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

  // Helper functions
  const getPrice = (prize) => {
    switch (prize) {
      case "เลขท้าย 2 ตัว":
        return 2000;
      case "เลขหน้า/ท้าย 3 ตัว":
        return 4000;
      case "รางวัลที่ 5":
        return 20000;
        case "รางวัลที่ 4":
        return 40000;
        case "รางวัลที่ 3":
        return 80000;
        case "รางวัลที่ 2":
        return 200000;
        case "รางวัลที่ 1":
        return 6000000;
      case "ข้างเคียงรางวัลที่ 1":
        return 100000;
      default:
        return 0;
    }
  };

  const getDiscountRate = (type) => {
    switch (type) {
      case "สลากกินแบ่งรัฐบาล":
        return 0.02;
      case "สลากการกุศล":
        return 0.025;
      default:
        return 0;
    }
  };

  const handleAddItem = () => {
    if (quantity < 1) return;
    const price = getPrice(selectedPrize);
    const discountRate = getDiscountRate(lotType);
    const discount = price * quantity * discountRate;
    const total = price * quantity - discount;

    const newItem = {
      id: Date.now(),
      lotType,
      prize: selectedPrize,
      quantity,
      price,
      discount,
      total,
    };

    setLotteryItems((prev) => [...prev, newItem]);
    setQuantity(1);
  };

  const handleDeleteItem = (id) => {
    setLotteryItems((prev) => prev.filter(item => item.id !== id));
  };

  const totalSum = lotteryItems.reduce((sum, item) => sum + item.total, 0);

  const handleSaveRecord = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      const payload = {
        docNumber,
        customerName,
        note,
        employee: session?.user?.name || "",
        employeeCode: session?.user?.employeeCode || "",
        branch: session?.user?.branch || "",
        shiftNo: currentShift.shiftNo || "",
        items: lotteryItems.map(item => ({
          currency: `${item.lotType} ${item.prize}`,
          rate: item.price,
          amount: item.quantity,
          total: item.total,
        })),
        total: totalSum,
        payType: "Lottery",
        payMethod: "Lottery",
        payMethodNote: "",
        receiveMethod: "เงินสด",
        receiveMethodNote: "",
      };

      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/record`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setDocNumber(data.docNumber);

        const payloadTHB = {
          docNumber: data.docNumber,
          employee: session?.user?.name || "",
          shiftNo: currentShift?.shiftNo || "",
          totalTHB: parseFloat(totalSum),
          action: "decrease",
        };
        console.log("📤 ส่งข้อมูล update-cash สำหรับ THB:", payloadTHB);
        await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/open-shift/update-cash`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloadTHB),
        });

        const total = parseFloat(totalSum).toFixed(2);
        window.open(
          `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/printreceipt?docNumber=${data.docNumber}&total=${total}`,
          "_blank",
          "width=500,height=400"
        );
      } else {
        alert("เกิดข้อผิดพลาด: " + data.message);
      }
    } catch (error) {
      console.error(error);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
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
              <h2 className="text-xl font-semibold text-gray-700">Lottery</h2>
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

            {/* New: Lot Type radio group */}
            <div className="mt-4">
              <label className="block font-medium mb-2">ประเภทสลาก:</label>
              <div className="flex flex-wrap gap-4">
                {["สลากกินแบ่งรัฐบาล", "สลากการกุศล"].map((type) => (
                  <label key={type} className="inline-flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="lotType"
                      value={type}
                      checked={lotType === type}
                      onChange={() => setLotType(type)}
                      className="form-radio text-blue-600"
                    />
                    <span className="ml-2">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* New: Prize radio group */}
            <div className="mt-4">
              <label className="block font-medium mb-2">รางวัล:</label>
              <div className="flex flex-wrap gap-4">
                {["เลขท้าย 2 ตัว", "เลขหน้า/ท้าย 3 ตัว", "รางวัลที่ 5", "รางวัลที่ 4", "รางวัลที่ 3", "รางวัลที่ 2", "รางวัลที่ 1", "ข้างเคียงรางวัลที่ 1"].map((prize) => (
                  <label key={prize} className="inline-flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="selectedPrize"
                      value={prize}
                      checked={selectedPrize === prize}
                      onChange={() => setSelectedPrize(prize)}
                      className="form-radio text-blue-600"
                    />
                    <span className="ml-2">{prize}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* New: Quantity input and Add button */}
            <div className="mt-4 flex items-center gap-4 max-w-xs">
              <label className="block font-medium">จำนวน:</label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="border px-2 py-1 w-20"
              />
              <button
                onClick={handleAddItem}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                เพิ่ม
              </button>
            </div>

            {/* New: Table of added items */}
            {lotteryItems.length > 0 && (
              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full border border-gray-300">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border px-3 py-2 text-left">รายการ</th>
                      <th className="border px-3 py-2 text-right">จำนวน</th>
                      <th className="border px-3 py-2 text-right">ราคา/หน่วย</th>
                      <th className="border px-3 py-2 text-right">ยอดหัก</th>
                      <th className="border px-3 py-2 text-right">จำนวนที่ได้รับ</th>
                      <th className="border px-3 py-2 text-center">ลบ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lotteryItems.map((item) => (
                      <tr key={item.id} className="odd:bg-white even:bg-gray-50">
                        <td className="border px-3 py-2">{item.lotType} {item.prize}</td>
                        <td className="border px-3 py-2 text-right">{item.quantity}</td>
                        <td className="border px-3 py-2 text-right">{item.price.toLocaleString()}</td>
                        <td className="border px-3 py-2 text-right">{item.discount.toLocaleString(undefined, {maximumFractionDigits:2})}</td>
                        <td className="border px-3 py-2 text-right">{item.total.toLocaleString()}</td>
                        <td className="border px-3 py-2 text-center">
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="text-red-600 hover:text-red-800"
                            aria-label="ลบรายการ"
                          >
                            ลบ
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* New: Total sum display */}
            <div className="mt-4 p-4 bg-black text-green-400 font-semibold text-lg rounded">
              ยอดรวม: {totalSum.toLocaleString()} บาท
            </div>

            {/* Extra fields for note */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="col-span-full">
                <label className="block font-medium">หมายเหตุทั่วไป:</label>
                <textarea className="w-full border px-2 py-1" value={note} onChange={(e) => setNote(e.target.value)}></textarea>
              </div>
            </div>

            <button onClick={handleSaveRecord} disabled={isSaving} className={`bg-blue-600 text-white px-4 py-2 rounded ${isSaving ? "cursor-not-allowed opacity-50" : ""}`}>
              บันทึกรายการ
            </button>
          </div>
        </div>
      </div>
      <Footer />
    </Container>
  );
}

export default LotteryPage;

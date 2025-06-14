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

    const [amountTHB, setAmountTHB] = useState("");
  const [feeTHB, setFeeTHB] = useState(0);
  const [feeMain, setFeeMain] = useState(0);
  const [deductTHB, setDeductTHB] = useState(0);
  const [payTHB, setPayTHB] = useState(0);
  const [payLAK, setPayLAK] = useState(0);
  const [rateTHB, setRateTHB] = useState(0);
  const [autoCalcTHB, setAutoCalcTHB] = useState(true);

  useEffect(() => {
    const amt = parseFloat((amountTHB || "0").toString().replace(/,/g, ""));
    let fee = 0;
    if (amt > 0 && amt <= 500) fee = 50;
    else if (amt <= 1000) fee = 60;
    else if (amt <= 5000) fee = 80;
    else if (amt <= 10000) fee = 120;
    else if (amt <= 20000) fee = 180;
    else if (amt <= 30000) fee = 270;
    else if (amt <= 40000) fee = 500;
    else if (amt <= 50000) fee = 550;
    else if (amt <= 60000) fee = 600;
    else if (amt <= 70000) fee = 650;
    else if (amt <= 80000) fee = 700;
    else if (amt <= 90000) fee = 850;
    else if (amt >= 100000) fee = 1000;
    setFeeTHB(fee);
  }, [amountTHB]);
  const { data: session } = useSession();

  const [currentShift, setCurrentShift] = useState({});

  const [postData, setPostData] = useState([]);
  const [records, setRecords] = useState([]);

  const userEmail = session?.user?.email;

  const [customerName, setCustomerName] = useState("");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [docNumber, setDocNumber] = useState("");

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
      if (data.posts) {
        const thbPost = data.posts.find(post => post.title === "THB");
        if (thbPost) setRateTHB(parseFloat(thbPost.selllaos || 0));
      }
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
              rate: 0,
              amount: 0,
              total: 0
            }
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
          total: 0,
          note
        })
      });

      const data = await res.json();
      if (res.ok) {
        setDocNumber(data.docNumber);

        window.open(
          `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/printreceipt?docNumber=${data.docNumber}&total=0`,
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

  useEffect(() => {
    const fee = parseFloat(feeTHB || 0);
    const deduct = parseFloat(deductTHB || 0);
    const payTHBValue = parseFloat(payTHB || 0);
    const remain = fee - deduct - payTHBValue;

    // อัพเดทจ่ายบาทสด (THB) = ค่าธรรมเนียม - หักในยอด
    if (autoCalcTHB) {
      if (fee - deduct > 0) {
        setPayTHB((fee - deduct).toFixed(2));
      } else {
        setPayTHB(0);
      }
    }

    // อัพเดทจ่ายกีบสด (LAK) = (ค่าธรรมเนียม - หักในยอด - จ่ายบาทสด) × เรท
    if (remain > 0 && rateTHB > 0) {
      const payLAKValue = remain * rateTHB;
      setPayLAK(payLAKValue);
    } else {
      setPayLAK(0);
    }
  }, [feeTHB, deductTHB, payTHB, rateTHB, autoCalcTHB]);

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
              <h2 className="text-xl font-semibold text-gray-700">THAI-LAOS</h2>
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

            {/* Radio button for THAI-LAOS or LAOS-THAI */}
            <div className="col-span-full mt-4">
              <label className="block font-medium mb-2 text-lg">เลือกประเภท:</label>
              <div className="flex gap-6 text-lg">
                <label className="flex items-center space-x-2">
                  <input type="radio" name="direction" value="THAI-LAOS" defaultChecked />
                  <span>THAI-LAOS</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="radio" name="direction" value="LAOS-THAI" />
                  <span>LAOS-THAI</span>
                </label>
              </div>
            </div>

            {/* ช่องกรอกยอดและค่าธรรมเนียม */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center mt-4 border p-4 rounded-md border-gray-300 bg-yellow-50">
              <div className="sm:col-span-2">
                <label className="block font-medium">ยอดที่โอน:</label>
                <input
                  type="text"
                  value={amountTHB}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/,/g, '');
                    if (!isNaN(raw)) {
                      const num = parseFloat(raw);
                      if (!isNaN(num)) setAmountTHB(num.toLocaleString());
                      else setAmountTHB("");
                    }
                  }}
                  className="w-full border px-2 py-1"
                  placeholder="เช่น 10,000"
                />
              </div>
              <div>
                <p className="text-red-600 font-semibold mt-6">ค่าธรรมเนียม: {feeTHB.toLocaleString()} บาท</p>
              </div>
            </div>
            <div className="col-span-full mt-4">
              <label className="block font-medium text-lg mb-2">ค่าธรรมเนียม</label>
              <div className="border border-gray-300 p-4 rounded-md">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    {/* Removed ค่าธรรมเนียมหลัก (THB) input as per instructions */}
                  </div>
                  <div>
                    <label className="block font-medium">หักในยอด (THB):</label>
                    <input
                      type="number"
                      className="w-full border px-2 py-1"
                      value={deductTHB}
                      onChange={(e) => setDeductTHB(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">
                      <input
                        type="checkbox"
                        checked={autoCalcTHB}
                        onChange={(e) => setAutoCalcTHB(e.target.checked)}
                        className="mr-1"
                      />
                      คำนวณอัตโนมัติ
                    </label>
                    <label className="block font-medium">จ่ายบาทสด (THB):</label>
                    <input
                      type="number"
                      className="w-full border px-2 py-1"
                      value={payTHB}
                      onChange={(e) => setPayTHB(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block font-medium">จ่ายกีบสด (LAK):</label>
                    <input
                      type="number"
                      className="w-full border px-2 py-1 bg-gray-100"
                      value={payLAK.toLocaleString()}
                      readOnly
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="col-span-full mt-4">
              <label className="block font-medium text-lg mb-2">รวมเป็นเงิน</label>
              <div className="border border-gray-300 p-4 rounded-md grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-medium">รวมเป็นเงิน (THB):</label>
                  <input type="number" className="w-full border px-2 py-1 bg-black text-green-500" />
                </div>
                <div>
                  <label className="block font-medium">จ่ายบาท (THB):</label>
                  <input type="number" className="w-full border px-2 py-1 bg-black text-green-500" />
                </div>
                <div>
                  <label className="block font-medium">จ่ายกีบ (LAK):</label>
                  <input type="number" className="w-full border px-2 py-1 bg-black text-green-500" />
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
              className={`bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 ${
                isSaving ? "pointer-events-none opacity-50" : ""
              }`}
            >
              {isSaving ? "กำลังบันทึกข้อมูล..." : "บันทึกรายการ"}
            </button>
          </div>
        </div>
      </div>
      <Footer />
    </Container>
  );
}

export default WelcomePage;

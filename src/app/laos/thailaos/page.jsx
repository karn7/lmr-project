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

  const [buyRate, setBuyRate] = useState(0);

  const [amountTHB, setAmountTHB] = useState("");
  const [feeTHB, setFeeTHB] = useState(0);
  const [feeMain, setFeeMain] = useState(0);
  const [rateTHB, setRateTHB] = useState(0);
  const [deductAmount, setDeductAmount] = useState(0);
  const [totalAfterDeduct, setTotalAfterDeduct] = useState(0);
  const [direction, setDirection] = useState("THAI-LAOS");
  // Add state for paidTHB and receivedTHB
  const [paidTHB, setPaidTHB] = useState("");
  const [receivedTHB, setReceivedTHB] = useState("");
  const [feePaidTHB, setFeePaidTHB] = useState("");
  const [feePaidLAK, setFeePaidLAK] = useState("");
  const [transferLAK, setTransferLAK] = useState("");

  useEffect(() => {
    const amt = parseFloat((amountTHB || "0").toString().replace(/,/g, ""));
    let fee = 0;
    if (amt > 0 && amt <= 500) fee = 50;
    else if (amt <= 1060) fee = 60;
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
        const buyPost = data.posts.find(post => post.title === "THB");
        if (buyPost) setBuyRate(parseFloat(buyPost.buylaos || 0));
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

  useEffect(() => {
    const amt = parseFloat((amountTHB || "0").toString().replace(/,/g, ""));
    setTotalAfterDeduct(amt - deductAmount);
  }, [amountTHB, deductAmount]);

  const handleSaveRecord = async () => {
    if (!navigator.onLine) {
      alert("ไม่สามารถบันทึกข้อมูลได้ เนื่องจากไม่มีการเชื่อมต่ออินเทอร์เน็ต");
      return;
    }

    // เตรียมหมายเหตุค่าธรรมเนียม
    let feeNote = [];
    if (feePaidTHB !== "0" && feePaidTHB !== "") feeNote.push(`จ่ายค่าธรรมเนียมด้วยเงินสดบาท ${feePaidTHB}`);
    if (feePaidLAK !== "0" && feePaidLAK !== "") feeNote.push(`จ่ายค่าธรรมเนียมด้วยเงินสดกีบ ${feePaidLAK}`);
    if (transferLAK !== "0" && transferLAK !== "") feeNote.push(`จ่ายค่าธรรมเนียมโดยโอนเข้ากีบ ${transferLAK}`);
    if (deductAmount > 0) feeNote.push(`หักจากยอด ${deductAmount.toLocaleString()} ບາດ`);

    const autoNote = feeNote.join(", ");
    const fullNote = [note, autoNote].filter(Boolean).join(" / ");

    setIsSaving(true);
    try {
      const res = await fetch("/api/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              currency: "THB",
              rate: 0,
              amount: 0,
              total: parseFloat((amountTHB || "0").toString().replace(/,/g, ""))
            },
            {
              currency: "THB",
              unit: "Fee",
              rate: 0,
              amount: 0,
              total: feeTHB
            }
          ],
          employee: session?.user?.name,
          employeeCode: session?.user?.employeeCode || "",
          branch: session?.user?.branch,
          shiftNo: currentShift?.shiftNo || "",
          customerName,
          payType: direction,
          payMethod: "",
          payMethodNote: "",
          receiveMethod: "",
          receiveMethodNote: "",
          total: parseFloat((amountTHB || "0").toString().replace(/,/g, "")),
          note: fullNote
        })
      });

      const data = await res.json();
      if (res.ok) {
        setDocNumber(data.docNumber);

        // 🧾 ส่งข้อมูล update-cash ตามประเภท
        const feeTHBValue = parseFloat((feePaidTHB || "0").toString().replace(/,/g, ""));
        const feeLAKValue = parseFloat((feePaidLAK || "0").toString().replace(/,/g, ""));
        const paidTHBValue = parseFloat((paidTHB || "0").toString().replace(/,/g, ""));
        const paidLAKValue = direction === "THAI-LAOS"
          ? Math.round((totalAfterDeduct - paidTHBValue) * buyRate)
          : Math.round((totalAfterDeduct - parseFloat(receivedTHB || "0")) * rateTHB);
        const receivedTHBValue = parseFloat((receivedTHB || "0").toString().replace(/,/g, ""));

        // ✅ บวกค่าธรรมเนียม (บาท)
        await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/open-shift/update-cash`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            docNumber: data.docNumber,
            employee: session?.user?.name || "",
            shiftNo: currentShift?.shiftNo || "",
            totalTHB: feeTHBValue,
            action: "increase",
          }),
        });

        // ✅ บวกค่าธรรมเนียม (กีบ เป็น THB)
        await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/open-shift/update-cash`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            docNumber: data.docNumber,
            employee: session?.user?.name || "",
            shiftNo: currentShift?.shiftNo || "",
            totalLAK: feeLAKValue,
            action: "increase",
          }),
        });

        // ✅ รวมเป็นเงิน (THB / LAK)
        if (direction === "THAI-LAOS") {
          // ลบ THB
          await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/open-shift/update-cash`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              docNumber: data.docNumber,
              employee: session?.user?.name || "",
              shiftNo: currentShift?.shiftNo || "",
              totalTHB: paidTHBValue,
              action: "decrease",
            }),
          });

          // ลบ LAK
          await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/open-shift/update-cash`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              docNumber: data.docNumber,
              employee: session?.user?.name || "",
              shiftNo: currentShift?.shiftNo || "",
              totalLAK: paidLAKValue,
              action: "decrease",
            }),
          });
        } else {
          // บวก THB
          await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/open-shift/update-cash`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              docNumber: data.docNumber,
              employee: session?.user?.name || "",
              shiftNo: currentShift?.shiftNo || "",
              totalTHB: receivedTHBValue,
              action: "increase",
            }),
          });

          // บวก LAK
          await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/open-shift/update-cash`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              docNumber: data.docNumber,
              employee: session?.user?.name || "",
              shiftNo: currentShift?.shiftNo || "",
              totalLAK: paidLAKValue,
              action: "increase",
            }),
          });
        }

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

  // Auto-update note when fee fields or payment fields change
  useEffect(() => {
    let feeNote = [];
    if (feePaidTHB !== "0" && feePaidTHB !== "") feeNote.push(`จ่ายค่าธรรมเนียมด้วยเงินสดบาท ${feePaidTHB}`);
    if (feePaidLAK !== "0" && feePaidLAK !== "") feeNote.push(`จ่ายค่าธรรมเนียมด้วยเงินสดกีบ ${feePaidLAK}`);
    if (transferLAK !== "0" && transferLAK !== "") feeNote.push(`จ่ายค่าธรรมเนียมโดยโอนเข้ากีบ ${transferLAK}`);
    if (deductAmount > 0) feeNote.push(`หักจากยอด ${deductAmount.toLocaleString()} ບາດ`);

    // เพิ่มข้อความหมายเหตุจากการจ่ายเงิน
    if (paidTHB !== "0" && paidTHB !== "") feeNote.push(`จ่าย ${paidTHB} ບາດ`);
    if (direction === "THAI-LAOS") {
      const rawPaidTHB = parseFloat((paidTHB || "0").toString().replace(/,/g, ""));
      const rawTotalAfterDeduct = parseFloat((totalAfterDeduct || "0").toString().replace(/,/g, ""));
      const paidLAKValue = Math.round((rawTotalAfterDeduct - rawPaidTHB) * buyRate);
      if (!isNaN(paidLAKValue) && paidLAKValue > 0) feeNote.push(`จ่าย ${paidLAKValue.toLocaleString()} ກີບ`);
    } else if (direction === "LAOS-THAI") {
      if (receivedTHB !== "0" && receivedTHB !== "") feeNote.push(`รับ ${receivedTHB} ບາດ`);
      const rawReceivedTHB = parseFloat((receivedTHB || "0").toString().replace(/,/g, ""));
      const rawTotal = parseFloat((amountTHB || "0").toString().replace(/,/g, ""));
      const paidLAKValue = Math.round((rawTotal - rawReceivedTHB) * rateTHB);
      if (!isNaN(paidLAKValue) && paidLAKValue > 0) feeNote.push(`รับ ${paidLAKValue.toLocaleString()} ກີບ`);
    }

    const autoNote = feeNote.join(", ");
    setNote(autoNote);
  }, [feePaidTHB, feePaidLAK, transferLAK, deductAmount, paidTHB, receivedTHB, direction, amountTHB, rateTHB, buyRate, totalAfterDeduct]);

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
              <h2 className="text-xl font-semibold text-gray-700">THAI-LAOS</h2>
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

            {/* Radio button for THAI-LAOS or LAOS-THAI */}
            <div className="col-span-full mt-4">
              <label className="block font-medium mb-2 text-lg">ເລືອກປະເພດ:</label>
              <div className="flex gap-6 text-lg">
                <label className="flex items-center space-x-2">
                  <input type="radio" name="direction" value="THAI-LAOS" checked={direction === "THAI-LAOS"} onChange={(e) => setDirection(e.target.value)} />
                  <span>THAI-LAOS</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="radio" name="direction" value="LAOS-THAI" checked={direction === "LAOS-THAI"} onChange={(e) => setDirection(e.target.value)} />
                  <span>LAOS-THAI</span>
                </label>
              </div>
            </div>

            {/* ช่องกรอกยอดและค่าธรรมเนียม */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center mt-4 border p-4 rounded-md border-gray-300 bg-yellow-50">
              <div className="sm:col-span-2">
                <label className="block font-medium">ຈຳນວນເງິນໂອນ:</label>
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
                  placeholder="ຕົວຢ່າງ 10,000"
                />
              </div>
              <div>
                <p className="text-red-600 font-semibold mt-6">
                  ຄ່າທຳນຽມ: {feeTHB.toLocaleString()} ບາດ 
                  ຫຼື {(feeTHB * rateTHB).toLocaleString()} ກີບ
                </p>
              </div>
            </div>


            {/* Removed ค่าธรรมเนียม inputs and related controls as per instructions */}
            <div className="col-span-full mt-4 border border-gray-300 p-4 rounded-md">
              <label className="block font-medium text-lg mb-2">ຄ່າທຳນຽມ</label>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block font-medium">ຫັກຈາກຍອດ:</label>
                  <input
                    type="number"
                    className="w-full border px-2 py-1"
                    value={deductAmount}
                    onChange={(e) => setDeductAmount(parseFloat(e.target.value || 0))}
                  />
                </div>
                <div>
                  <label className="block font-medium">ບາດ(ສົດ):</label>
                  <input
                    type="text"
                    className="w-full border px-2 py-1"
                    value={feePaidTHB}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/,/g, "");
                      if (!isNaN(raw)) {
                        const num = parseFloat(raw);
                        if (!isNaN(num)) setFeePaidTHB(num.toLocaleString());
                        else setFeePaidTHB("");
                      }
                    }}
                  />
                </div>
                <div>
                  <label className="block font-medium">ກີບ(ສົດ):</label>
                  <input
                    type="text"
                    className="w-full border px-2 py-1"
                    value={feePaidLAK}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/,/g, "");
                      if (!isNaN(raw)) {
                        const num = parseFloat(raw);
                        if (!isNaN(num)) setFeePaidLAK(num.toLocaleString());
                        else setFeePaidLAK("");
                      }
                    }}
                  />
                </div>
                <div>
                  <label className="block font-medium">ໂອນເງິນກີບ:</label>
                  <input
                    type="text"
                    className="w-full border px-2 py-1"
                    value={transferLAK}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/,/g, "");
                      if (!isNaN(raw)) {
                        const num = parseFloat(raw);
                        if (!isNaN(num)) setTransferLAK(num.toLocaleString());
                        else setTransferLAK("");
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="col-span-full mt-4">
              <label className="block font-medium text-lg mb-2">ລວມເປັນເງິນ</label>
              <div className="border border-gray-300 p-4 rounded-md grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-medium">ລວມເປັນເງິນ (THB):</label>
                  <input
                    type="number"
                    className="w-full border px-2 py-1 bg-black text-green-500"
                    value={totalAfterDeduct}
                    readOnly
                  />
                </div>
                {direction === "LAOS-THAI" ? (
                  <>
                    <div>
                      <label className="block font-medium">ຮັບບາດ (THB):</label>
                      <input
                        type="number"
                        className="w-full border px-2 py-1 bg-black text-green-500"
                        value={receivedTHB}
                        onChange={(e) => setReceivedTHB(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block font-medium">ຮັບກີບ (LAK):</label>
                      <input
                        type="number"
                        className="w-full border px-2 py-1 bg-black text-green-500"
                        value={
                          direction === "LAOS-THAI"
                            ? Math.round((totalAfterDeduct - parseFloat(receivedTHB || 0)) * rateTHB)
                            : ""
                        }
                        readOnly
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block font-medium">ຈ່າຍບາດ (THB):</label>
                      <input
                        type="number"
                        className="w-full border px-2 py-1 bg-black text-green-500"
                        value={paidTHB}
                        onChange={(e) => setPaidTHB(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block font-medium">ຈ່າຍກີບ (LAK):</label>
                      <input
                        type="number"
                        className="w-full border px-2 py-1 bg-black text-green-500"
                        value={
                          direction === "THAI-LAOS"
                            ? Math.round((totalAfterDeduct - parseFloat(paidTHB || 0)) * buyRate)
                            : Math.round((totalAfterDeduct - parseFloat(receivedTHB || 0)) * rateTHB)
                        }
                        readOnly
                      />
                    </div>
                  </>
                )}
              </div>
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

"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useRouter } from "next/navigation";
import Link from "next/link";

function ExchangePage() {
  const { data: session } = useSession();

  const [currencies, setCurrencies] = useState([]);
  const [selectedCurrency, setSelectedCurrency] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState("");
  const [rate, setRate] = useState("");
  const [amount, setAmount] = useState("");
  const [records, setRecords] = useState([]);
  const [payType, setPayType] = useState("Selling");
  const [payMethod, setPayMethod] = useState("cash");
  const [payMethodNote, setPayMethodNote] = useState("");
  const [receiveMethod, setReceiveMethod] = useState("cash");
  const [receiveMethodNote, setReceiveMethodNote] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [branch, setBranch] = useState("สาขา 1");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [docNumber, setDocNumber] = useState("");
  const [note, setNote] = useState("");
  const [currentShift, setCurrentShift] = useState(null);
  const router = useRouter();



  useEffect(() => {
      const fetchCurrencies = async () => {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/posts`);
        const data = await res.json();
        const filtered = data.posts.filter((c) => c.title !== "THB");
        setCurrencies(filtered);
      };
    
      fetchCurrencies();
    }, []);

  useEffect(() => {
    const fetchShift = async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/open-shift/check?employee=${session?.user?.name}`);
      const data = await res.json();
      if (data?.open && data?.shiftNo) {
        setCurrentShift(data);
      } else {
        console.warn("ไม่พบข้อมูลการเปิดร้านหรือร้านถูกปิดแล้ว");
      }
    };

    if (session?.user?.name) {
      fetchShift();
    }
  }, [session?.user?.name]);

  const handleSelectCurrency = (currency) => {
    setSelectedCurrency(currency);
    setSelectedUnit("");
    setRate("");
  };

  const handleAddRecord = () => {
    if (!selectedCurrency || !rate || !amount) return;
    const total = parseFloat((parseFloat(rate) * parseFloat(amount)).toFixed(2));
    const newRecord = {
      currency: selectedCurrency.title,
      unit: selectedUnit === "-" ? "" : selectedUnit,
      rate,
      amount,
      total,
    };
    setRecords([...records, newRecord]);
    setSelectedUnit("");
    setRate("");
    setAmount("");
  };

  const handleDelete = (index) => {
    const updated = [...records];
    updated.splice(index, 1);
    setRecords(updated);
  };

  const totalSum = records.reduce((sum, r) => sum + r.total, 0);

  const uniqueCurrencies = Array.from(
    new Map(currencies.map((c) => [c.title, c])).values()
  );

  const filteredUnits = currencies.filter(
    (c) => c.title === selectedCurrency?.title
  );
  const amountRef = useRef(null);

  // Auto set rate for currency with single unit (content == "-") on select
  useEffect(() => {
    if (
      selectedCurrency &&
      filteredUnits.length === 1 &&
      filteredUnits[0].content.trim() === "-"
    ) {
      setSelectedUnit("");
      setRate(filteredUnits[0].sell);
      setTimeout(() => {
        amountRef.current?.focus();
      }, 0);
    }
    // do not clear rate if user edits it
    // eslint-disable-next-line
  }, [selectedCurrency]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Enter") {
        if (!selectedCurrency || !rate || !amount) return;
        handleAddRecord();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedCurrency, selectedUnit, rate, amount]);

  const handleSave = async () => {
    const confirmSave = confirm("คุณต้องการบันทึกรายการหรือไม่?");
    if (!confirmSave) return;

    try {
      // Generate doc number: WS + year(BE) + month + day + hour + minute + second
      const now = new Date();
      const buddhistYear = now.getFullYear() + 543;
      const formattedDate = `${buddhistYear.toString().slice(-2)}${(now.getMonth() + 1).toString().padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}${now.getHours().toString().padStart(2, "0")}${now.getMinutes().toString().padStart(2, "0")}${now.getSeconds().toString().padStart(2, "0")}`;
      const generatedDocNumber = `WS${formattedDate}`;

      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docNumber: generatedDocNumber,
          date,
          employee: session?.user?.name || "",
          customerName,
          note,
          branch: session?.user?.branch || "",
          payType: "Wholesale",
          payMethod,
          payMethodNote,
          receiveMethod,
          receiveMethodNote,
          total: totalSum,
          items: records,
          timestamp: new Date().toISOString(),
          shiftNo: currentShift?.shiftNo || "",
        }),
      });

      if (res.ok) {
        const { docNumber } = await res.json();
        setDocNumber(generatedDocNumber);
        const total = totalSum.toFixed(2);
        window.open(
          `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/printreceipt?docNumber=${docNumber}&total=${total}`,
          "_blank",
          "width=500,height=400"
        );
      } else {
        alert("เกิดข้อผิดพลาดในการบันทึก");
      }
    } catch (error) {
      console.error("Error saving record:", error);
    }
  };

  return (
    <div className="bg-orange-500 min-h-screen p-4 text-black">
      <div className="flex justify-between items-start">
        <Link
          href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/welcome`}
          className="bg-gray-500 inline-block text-white border py-2 px-3 rounded my-2"
        >
          กลับ
        </Link>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2 bg-white p-4 rounded shadow mt-2 text-sm">
            <div>
              <div>เลขที่รายการ</div>
              <input
                type="text"
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                className="w-full px-2 py-1 border rounded"
              />
            </div>
            <div>
              <div>วันที่</div>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-2 py-1 border rounded"
              />
            </div>
            <div>
              <div>พนักงาน</div>
              <input
                type="text"
                value={session?.user?.name || ""}
                readOnly
                className="w-full px-2 py-1 border rounded bg-gray-100"
              />
            </div>
            <div>
              <div>สาขา</div>
              <input
                type="text"
                value={session?.user?.branch || ""}
                readOnly
                className="w-full px-2 py-1 border rounded bg-gray-100"
              />
            </div>
            <div className="col-span-2">
              <div>ชื่อลูกค้า</div>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-2 py-1 border rounded"
              />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 bg-white p-4 rounded shadow mt-2 text-sm">
          <div>
            <div>ประเภทลูกค้า</div>
            <label>
              <input
                type="radio"
                name="ptype"
                value="Selling"
                checked={payType === "Selling"}
                onChange={() => setPayType("Selling")}
              />{" "}
              Selling
            </label>
            <label className="ml-4">
              <input
                type="radio"
                name="ptype"
                value="NP(S)"
                checked={payType === "NP(S)"}
                onChange={() => setPayType("NP(S)")}
              />{" "}
              NP
            </label>
          </div>
          <div>
            <div>ลูกค้าจ่ายเงินเป็น</div>
            <label>
              <input
                type="radio"
                name="paymethod"
                value="cash"
                checked={payMethod === "cash"}
                onChange={() => setPayMethod("cash")}
              />{" "}
              เงินสด
            </label>
            <label className="ml-4">
              <input
                type="radio"
                name="paymethod"
                value="transfer"
                checked={payMethod === "transfer"}
                onChange={() => setPayMethod("transfer")}
              />{" "}
              โอนเข้าบัญชี
            </label>
            {payMethod === "transfer" && (
              <input
                type="text"
                className="w-full mt-1 px-2 py-1 border rounded"
                placeholder="รายละเอียดบัญชีที่โอนเข้า"
                value={payMethodNote}
                onChange={(e) => setPayMethodNote(e.target.value)}
              />
            )}
          </div>
          <div></div>
          <div>
            <div>ลูกค้ารับเงินเป็น</div>
            <label>
              <input
                type="radio"
                name="receivemethod"
                value="cash"
                checked={receiveMethod === "cash"}
                onChange={() => setReceiveMethod("cash")}
              />{" "}
              เงินสด
            </label>
            <label className="ml-4">
              <input
                type="radio"
                name="receivemethod"
                value="transfer"
                checked={receiveMethod === "transfer"}
                onChange={() => setReceiveMethod("transfer")}
              />{" "}
              โอนเข้าบัญชี
            </label>
            {receiveMethod === "transfer" && (
              <input
                type="text"
                className="w-full mt-1 px-2 py-1 border rounded"
                placeholder="รายละเอียดบัญชีที่รับโอน"
                value={receiveMethodNote}
                onChange={(e) => setReceiveMethodNote(e.target.value)}
              />
            )}
          </div>
        </div>
        <div className="text-right bg-black text-green-400 px-6 py-4 text-4xl font-bold rounded shadow h-fit">
          ยอดรวม: {totalSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
          <span className="text-sm">THB</span>
        </div>
      </div>

      <div className="mt-6 flex gap-6">
        {/* Flag Panel */}
        <div className="bg-white p-1 rounded shadow grid grid-cols-3 gap-2 justify-items-center items-start h-fit">
          {uniqueCurrencies.map((currency, index) => (
            <button
              key={index}
              onClick={() => handleSelectCurrency(currency)}
              className={`border rounded overflow-hidden ${
                selectedCurrency?.title === currency.title
                  ? "ring-2 ring-yellow-300"
                  : ""
              }`}
              style={{ padding: 0, width: "76px", height: "46px" }}
            >
              <div className="relative w-full h-full">
                <img
                  src={`/cur/${currency.title.toUpperCase()}.png`}
                  alt={currency.title}
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-0 left-0 right-0 text-center text-xs font-bold bg-black bg-opacity-50 text-white">
                  {currency.title}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Right Panel */}
        <div className="flex flex-col gap-4 w-3/4">
          {selectedCurrency && (
            <>
              <div className="bg-white p-4 rounded shadow">
                <div className="mb-2">เลือกหน่วย</div>
                <div className="flex flex-wrap gap-2">
                  {filteredUnits.map((c, i) => {
                    const isDashUnit = c.content.trim() === "-";
                    return (
                      <button
                        key={i}
                        className={`px-4 py-2 rounded border ${
                          selectedUnit === c.content
                            ? "bg-yellow-300"
                            : "bg-gray-100"
                        }`}
                        onClick={() => {
                          setSelectedUnit(c.content);
                          setRate(c.sell); // use 'sell' for selling page
                          setTimeout(() => {
                            amountRef.current?.focus();
                          }, 0);
                        }}
                      >
                        {isDashUnit ? "-" : c.content}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="bg-white p-4 rounded shadow grid grid-cols-2 gap-4">
                <div>
                  <label>เรท</label>
                  <input
                    type="number"
                    className="w-full px-2 py-1 border rounded"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                  />
                </div>
                <div>
                  <label>จำนวน</label>
                  <input
                    type="text"
                    ref={amountRef}
                    className="w-full px-2 py-1 border rounded text-right"
                    value={amount === "" ? "" : Number(amount).toLocaleString()}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/,/g, "");
                      if (!isNaN(raw)) setAmount(raw);
                    }}
                  />
                </div>
                <div className="col-span-2">
                  <button
                    onClick={handleAddRecord}
                    className="bg-blue-500 text-white py-2 px-4 rounded"
                  >
                    เพิ่มรายการ
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="bg-white p-4 rounded shadow">
            <table className="w-full border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2">สกุลเงิน</th>
                  <th className="border p-2">หน่วย</th>
                  <th className="border p-2">เรท</th>
                  <th className="border p-2">จำนวน</th>
                  <th className="border p-2">รวม</th>
                  <th className="border p-2">ลบ</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={i}>
                    <td className="border p-2">{r.currency}</td>
                    <td className="border p-2">{r.unit}</td>
                    <td className="border p-2">{r.rate}</td>
                    <td className="border p-2">{Number(r.amount).toLocaleString()}</td>
                    <td className="border p-2">{r.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="border p-2 text-center">
                      <button
                        onClick={() => handleDelete(i)}
                        className="text-red-500"
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4">
            <label className="block text-white font-semibold mb-1">หมายเหตุ</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 rounded border text-black"
              placeholder="กรอกหมายเหตุเพิ่มเติม (ถ้ามี)"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              className="bg-green-600 text-white py-2 px-6 rounded text-lg"
            >
              บันทึกรายการ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExchangePage;

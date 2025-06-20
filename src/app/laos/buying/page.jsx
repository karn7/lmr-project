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
  const [payType, setPayType] = useState("Buying");
  const [payMethod, setPayMethod] = useState("cash");
  const [payMethodNote, setPayMethodNote] = useState("");
  const [receiveMethod, setReceiveMethod] = useState("cash");
  const [receiveMethodNote, setReceiveMethodNote] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [docNumber, setDocNumber] = useState("");
  const [note, setNote] = useState("");
  const [currentShift, setCurrentShift] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const router = useRouter();

  useEffect(() => {
    const fetchCurrencies = async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/posts`);
      const data = await res.json();
      const filtered = data.posts.filter((c) => c.title !== "LAK");
      setCurrencies(filtered);
    };
  
    fetchCurrencies();
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

  const handleSelectCurrency = (currency) => {
    setSelectedCurrency(currency);
    setSelectedUnit("");
    setRate("");
  };

  const handleAddRecord = () => {
    if (!selectedCurrency || !rate || !amount) return;

    const unitToUse = selectedUnit === "-" ? "" : selectedUnit;
    const total = parseFloat((parseFloat(rate) * parseFloat(amount)).toFixed(2));
    const newRecord = {
      currency: selectedCurrency.title,
      unit: unitToUse,
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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Enter") {
        handleAddRecord();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedCurrency, selectedUnit, rate, amount]);

  // ดึงเรทอัตโนมัติเมื่อเลือกสกุลที่มีหน่วยเดียวและ content เป็น "-"
  useEffect(() => {
    if (
      selectedCurrency &&
      filteredUnits.length === 1 &&
      filteredUnits[0].content.trim() === "-"
    ) {
      setSelectedUnit("");
      setRate(filteredUnits[0].buylaos);
      setTimeout(() => {
        amountRef.current?.focus();
      }, 0);
    }
  }, [selectedCurrency]);

  // ตรวจสอบเงื่อนไขการโอนเงินเข้า บช.
  useEffect(() => {
    const thbTotal = records
      .filter(r => r.currency === "THB")
      .reduce((sum, r) => sum + r.total, 0);

    const usdTotal = records
      .filter(r => r.currency === "USD")
      .reduce((sum, r) => sum + r.total, 0);

    const allowTransfer = thbTotal >= 10000 || usdTotal >= 500;

    if (receiveMethod === "transfer" && !allowTransfer) {
      alert("ไม่สามารถเลือกโอนเข้าบัญชีได้ เว้นแต่ยอด THB ≥ 10,000 หรือ USD ≥ 500");
      setReceiveMethod("cash");
    }
  }, [receiveMethod, records]);

  const handleSave = async () => {
    if (!navigator.onLine) {
      alert("ไม่สามารถบันทึกได้ เนื่องจากไม่มีการเชื่อมต่ออินเทอร์เน็ต");
      return;
    }
    const confirmSave = confirm("คุณต้องการบันทึกรายการหรือไม่?");
    if (!confirmSave) return;
    setIsSaving(true);
    try {
      // Force payMethod and receiveMethod to "cash"
      const payMethodFixed = "cash";
      const receiveMethodFixed = "cash";
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docNumber,
          date,
          employee: session?.user?.name || "",
          employeeCode: session?.user?.employeeCode || "",
          shiftNo: currentShift?.shiftNo || "",
          customerName,
          note,
          branch: session?.user?.branch || "",
          payType,
          payMethod: payMethodFixed,
          payMethodNote,
          receiveMethod: receiveMethodFixed,
          receiveMethodNote,
          total: totalSum,
          items: records,
          timestamp: new Date().toISOString(),
        }),
      });

      // Add: Notify if payType is Unusable
      if (payType === "Unusable") {
        await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/Notification`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            docNumber,
            employee: session?.user?.name || "",
            message: `พนักงาน ${session?.user?.name} ทำรายการประเภท Unusable (${docNumber})`,
            type: "specialAction",
          }),
        });
      }

      if (res.ok) {
        const { docNumber } = await res.json();

        if (receiveMethod !== "transfer") {
          // ส่งยอดรวม LAK เป็น decrease ก่อน
          const payloadTHB = {
            docNumber,
            employee: session?.user?.name || "",
            shiftNo: currentShift?.shiftNo,
            totalLAK: totalSum,
            action: "decrease",
          };
          console.log("📤 ส่งข้อมูล update-cash สำหรับ THB:", payloadTHB);
          await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/open-shift/update-cash`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payloadTHB),
          });
        }

        if (payMethod !== "transfer") {
          for (const record of records) {
            const payload = {
              docNumber,
              employee: session?.user?.name || "",
              shiftNo: currentShift?.shiftNo,
              currency: record.currency,
              amount: parseFloat(record.amount),
              action: "increase",
            };
            console.log("📤 ส่งข้อมูล update-cash:", payload);
            await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/open-shift/update-cash`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
          }
        }

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
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`bg-orange-500 min-h-screen p-4 text-black ${isSaving ? 'pointer-events-none opacity-50' : ''}`}>
      <div className="flex justify-between items-start">
        <Link
          href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/laos/exchange`}
          className="bg-gray-500 inline-block text-white border py-2 px-3 rounded my-2"
        >
          ກັບຄືນ
        </Link>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2 bg-white p-4 rounded shadow mt-2 text-sm">
            <div>
              <div>ເລກທີລາຍການ</div>
              <input
                type="text"
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                className="w-full px-2 py-1 border rounded"
              />
            </div>
            <div>
              <div>ວັນທີ</div>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-2 py-1 border rounded"
              />
            </div>
            <div>
              <div>ພະນັກງານ</div>
              <input
                type="text"
                value={session?.user?.name || ""}
                readOnly
                className="w-full px-2 py-1 border rounded bg-gray-100"
              />
            </div>
            <div>
              <div>ສາຂາ</div>
              <input
                type="text"
                value={session?.user?.branch || ""}
                readOnly
                className="w-full px-2 py-1 border rounded bg-gray-100"
              />
            </div>
            <div className="col-span-2">
              <div>ຊື່ລູກຄ້າ</div>
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
            <div>ປະເພດການຊື້</div>
            <label>
              <input
                type="radio"
                name="ptype"
                value="Buying"
                checked={payType === "Buying"}
                onChange={() => setPayType("Buying")}
              />{" "}
              Buying
            </label>
            <label className="ml-4">
              <input
                type="radio"
                name="ptype"
                value="Unusable"
                checked={payType === "Unusable"}
                onChange={() => setPayType("Unusable")}
              />{" "}
              ເງິນລົດອັດຕາ (ມີຕຳໜິ ເງິນຫຼຽນ)
            </label>
          </div>
          {/* เพิ่มส่วนเลือกวิธีที่ลูกค้าจ่ายเงิน */}
          <div className="col-span-2">
            <div>ລູກຄ້າຈ່າຍເງິນເປັນ</div>
            <label>
              <input
                type="radio"
                name="paymethod"
                value="cash"
                checked={payMethod === "cash"}
                onChange={() => setPayMethod("cash")}
              />{" "}
              ເງິນສົດ
            </label>
            <label className="ml-4">
              <input
                type="radio"
                name="paymethod"
                value="transfer"
                checked={payMethod === "transfer"}
                onChange={() => setPayMethod("transfer")}
              />{" "}
              ໂອນເຂົ້າບັນຊີ
            </label>
          </div>
          <div className="col-span-2">
            <div>ລູກຄ້າໄດ້ຮັບເງິນເປັນ</div>
            <label>
              <input
                type="radio"
                name="receivemethod"
                value="cash"
                checked={receiveMethod === "cash"}
                onChange={() => setReceiveMethod("cash")}
              />{" "}
              ເງິນສົດ
            </label>
            <label className="ml-4">
              <input
                type="radio"
                name="receivemethod"
                value="transfer"
                checked={receiveMethod === "transfer"}
                disabled={
                  records.filter(r => r.currency === "THB").reduce((sum, r) => sum + r.total, 0) < 10000 &&
                  records.filter(r => r.currency === "USD").reduce((sum, r) => sum + r.total, 0) < 500
                }
                onChange={() => setReceiveMethod("transfer")}
              />{" "}
              ໂອນເຂົ້າບັນຊີ
            </label>
          </div>
          <div></div>
        </div>
        <div className="text-right bg-black text-green-400 px-6 py-4 text-4xl font-bold rounded shadow h-fit">
          ຍອດລວມ:{" "}
          {Number.isInteger(totalSum)
            ? totalSum.toLocaleString()
            : totalSum.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
          <span className="text-sm">LAK</span>
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
              style={{ padding: 0, width: "76px", height: "52px" }}
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

        <div className="flex flex-col gap-4 w-3/4">
          {selectedCurrency && (
            <>
              <div className="bg-white p-4 rounded shadow">
                <div className="mb-2">ເລືອກຫນ່ວຍ</div>
                <div className="flex flex-wrap gap-2">
                  {filteredUnits.map((c, i) => {
                    if (c.content.trim() === "-") return null;

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
                          setRate(c.buylaos);
                          setTimeout(() => {
                            amountRef.current?.focus();
                          }, 0);
                        }}
                      >
                        {c.content}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="bg-white p-4 rounded shadow grid grid-cols-2 gap-4">
                <div>
                  <label>ອັດຕາ</label>
                  <input
                    type="number"
                    className="w-full px-2 py-1 border rounded"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    disabled={payType !== "Unusable"}
                  />
                </div>
                <div>
                  <label>ຈຳນວນ</label>
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
                    ເພີ່ມລາຍການ
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="bg-white p-4 rounded shadow">
            <table className="w-full border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2">ສະກຸນເງິນ</th>
                  <th className="border p-2">ຫນ່ວຍ</th>
                  <th className="border p-2">ອັດຕາ</th>
                  <th className="border p-2">ຈຳນວນ</th>
                  <th className="border p-2">ລວມ</th>
                  <th className="border p-2">ລົບ</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={i}>
                    <td className="border p-2">{r.currency}</td>
                    <td className="border p-2">{r.unit}</td>
                    <td className="border p-2">{r.rate}</td>
                    <td className="border p-2">
                      {Number(r.amount).toLocaleString()}
                    </td>
                    <td className="border p-2">
                      {r.total.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
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
            <label className="block text-white font-semibold mb-1">
              ໝາຍເຫດ
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 rounded border text-black"
              placeholder="ໃສ່ໝາຍເຫດເພີ່ມ (ຖ້າມີ)"
            />
          </div>

          {isSaving && (
            <div className="text-white font-bold mb-2">ກຳລັງບັນທຶກຂໍ້ມູນ...</div>
          )}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              className="bg-green-600 text-white py-2 px-6 rounded text-lg"
              disabled={isSaving || records.length === 0}
            >
              ບັນທຶກລາຍການ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExchangePage;

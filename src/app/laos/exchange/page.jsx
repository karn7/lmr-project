"use client";

import React, { useState, useEffect } from "react";
import Container from "../components/Container";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import UserSideNav from "../components/laosSideNav";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { format } from "date-fns";

function WelcomePage() {
  const { data: session } = useSession();
  if (!session) redirect(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/login`);
  // Redirect to /mainthai if user is from Thailand
  if (session?.user?.country === "Thai") {
    redirect(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/mainthai`);
  }
  console.log(session);

  if (session?.user?.role === "admin") redirect(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/admin`);

  const [postData, setPostData] = useState([]);
  const [records, setRecords] = useState([]);

  const [sortKey, setSortKey] = useState(null);
  const [sortOrder, setSortOrder] = useState("asc");

  const [activeRowIndex, setActiveRowIndex] = useState(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedDocNumber, setSelectedDocNumber] = useState(null);
  const [deleteReason, setDeleteReason] = useState("");

  const userEmail = session?.user?.email;

  const getPosts = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/posts?email=${userEmail}`, {
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

  const getRecords = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/record`);
      const data = await res.json();
      const today = new Date().toISOString().slice(0, 10);
      const todayRecords = data.records.filter((r) => {
        const created = new Date(r.createdAt).toISOString().slice(0, 10);
        return created === today && r.employee === session?.user?.name;
      });
      todayRecords.sort((a, b) => a.docNumber.localeCompare(b.docNumber));
      setRecords(todayRecords);
    } catch (error) {
      console.error("Error fetching records:", error);
    }
  };

  useEffect(() => {
    getPosts();
    getRecords();
  }, []);

  const sortedRecords = [...records].sort((a, b) => {
    if (!sortKey) return 0;
    let aValue = a[sortKey];
    let bValue = b[sortKey];

    if (sortKey === "createdAt") {
      aValue = new Date(aValue);
      bValue = new Date(bValue);
    }

    if (typeof aValue === "string") {
      return sortOrder === "asc"
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    } else {
      return sortOrder === "asc"
        ? aValue - bValue
        : bValue - aValue;
    }
  });

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const handleRequestDelete = async () => {
    const employee = session?.user?.name;
    const message = `พนักงาน ${employee} ขออนุมัติลบรายการ ${selectedDocNumber}`;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/Notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          docNumber: selectedDocNumber,
          employee,
          message,
          type: "deleteRequest",
          details: {
            reason: deleteReason,
          },
        }),
      });

      if (res.ok) {
        alert("แจ้งขอลบเรียบร้อยแล้ว");
      } else {
        alert("เกิดข้อผิดพลาดในการแจ้งขอลบ");
      }
    } catch (error) {
      console.error("Request delete error:", error);
      alert("เกิดข้อผิดพลาด");
    } finally {
      setIsDeleteModalOpen(false);
      setDeleteReason("");
    }
  };

  return (
    <Container>
      <Navbar session={session} />
      <div className="flex-grow">
        <div className="container mx-auto my-10 px-5">
          <div className="flex gap-8">
            <div className="w-64 flex-shrink-0">
              <UserSideNav />
            </div>
            <div className="flex-1 bg-white shadow-md rounded-lg p-5">
              <div className="flex justify-between items-start"></div>

              <div className="flex justify-between mb-6">
                <div className="flex gap-4">
                  <Link href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/laos/buying`}>
                    <button className="bg-green-500 text-white py-2 px-3 rounded-md text-lg hover:bg-green-600">
                      Buy
                    </button>
                  </Link>
                  <Link href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/laos/selling`}>
                    <button className="bg-green-500 text-white py-2 px-3 rounded-md text-lg hover:bg-green-600">
                      Sell
                    </button>
                  </Link>
                  <Link href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/laos/wechat`}>
                    <button className="bg-blue-500 text-white py-2 px-3 rounded-md text-lg hover:bg-blue-600">
                      Wechat
                    </button>
                  </Link>
                  <Link href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/laos/withdraw`}>
                    <button className="bg-blue-500 text-white py-2 px-3 rounded-md text-lg hover:bg-blue-600">
                      Withdraw
                    </button>
                  </Link>
                  <Link href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/laos/moneygram`}>
                    <button className="bg-purple-500 text-white py-2 px-3 rounded-md text-lg hover:bg-purple-600">
                      Moneygram
                    </button>
                  </Link>
                  <Link href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/laos/thailaos`}>
                    <button className="bg-yellow-500 text-white py-2 px-3 rounded-md text-lg hover:bg-yellow-600">
                      Thai-Laos
                    </button>
                  </Link>
                </div>
                <button
                  onClick={getRecords}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
                >
                  🔄 ຣີເຟຣຊຂໍ້ມູນ
                </button>
              </div>

              <table className="w-full border">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border px-3 py-2 cursor-pointer" onClick={() => handleSort('docNumber')}>
                      ເລກທີລາຍການ {sortKey === 'docNumber' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                    <th className="border px-3 py-2 cursor-pointer" onClick={() => handleSort('createdAt')}>
                      ເວລາ {sortKey === 'createdAt' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                    <th className="border px-3 py-2 cursor-pointer" onClick={() => handleSort('total')}>
                      ຍອດລວມ {sortKey === 'total' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                    <th className="border px-3 py-2 cursor-pointer" onClick={() => handleSort('payType')}>
                      ປະເພດ {sortKey === 'payType' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRecords.map((record, index) => (
                    <React.Fragment key={index}>
                      <tr
                        className={`text-center cursor-pointer ${
                          record.payType === "Buying"
                            ? "text-green-600"
                            : record.payType === "Selling"
                            ? "text-orange-500"
                            : "text-black"
                        }`}
                        onClick={() => setActiveRowIndex(index === activeRowIndex ? null : index)}
                      >
                        <td className="border px-3 py-1">{record.docNumber}</td>
                        <td className="border px-3 py-1">
                          {format(new Date(record.createdAt), "HH:mm:ss")}
                        </td>
                        <td className="border px-3 py-1">
                          {Number(record.total).toLocaleString(undefined, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })}
                        </td>
                        <td className="border px-3 py-1">{record.payType}</td>
                      </tr>
                      {activeRowIndex === index && (
                        <tr>
                          <td colSpan="4" className="border px-3 py-2 bg-gray-50 text-center">
                            {/* Action buttons (no Edit) */}
                            <button
                              onClick={() =>
                                window.open(
                                  `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/printreceipt?docNumber=${record.docNumber}&total=${record.total}`,
                                  "_blank",
                                  "width=500,height=400"
                                )
                              }
                              className="bg-gray-800 text-white px-3 py-1 rounded hover:bg-gray-700 text-sm"
                            >
                              Print
                            </button>
                            <button
                              onClick={() => {
                                setSelectedDocNumber(record.docNumber);
                                setIsDeleteModalOpen(true);
                              }}
                              className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 text-sm ml-2"
                            >
                              ລຶບ
                            </button>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <Footer />
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-md w-full max-w-sm">
            <h2 className="text-lg font-semibold mb-4">ກະລຸນາໃສ່ເຫດຜົນໃນການລຶບ</h2>
            <textarea
              className="w-full border rounded p-2 mb-4"
              rows={3}
              placeholder="ເຫດຜົນ..."
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
            ></textarea>
            <div className="flex justify-end gap-3">
              <button
                className="bg-gray-300 hover:bg-gray-400 text-black px-3 py-1 rounded"
                onClick={() => setIsDeleteModalOpen(false)}
              >
                ຍົກເລີກ
              </button>
              <button
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
                onClick={handleRequestDelete}
              >
                ຢືນຢັນຂອລຶບ
              </button>
            </div>
          </div>
        </div>
      )}
    </Container>
  );
}

export default WelcomePage;

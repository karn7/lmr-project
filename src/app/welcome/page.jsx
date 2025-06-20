"use client";

import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import UserSideNav from "../components/userSideNav";
import Link from "next/link";
import Image from "next/image";
import Container from "../components/Container";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import DeleteBtn from "./DeleteBtn";
import { format } from "date-fns";

function WelcomePage() {
  const { data: session } = useSession();
  if (!session) redirect(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/login`);
  // Redirect to homepage if user is not from Thailand
  if (session?.user?.country !== "Thai") {
    redirect(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/`);
  }
  console.log(session);

  if (session?.user?.role === "admin") redirect(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/admin`);

  const [postData, setPostData] = useState([]);
  const [records, setRecords] = useState([]);

  const [sortKey, setSortKey] = useState(null);
  const [sortOrder, setSortOrder] = useState("asc");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editNote, setEditNote] = useState("");
  const [selectedDocNumber, setSelectedDocNumber] = useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");

  const [selectedRow, setSelectedRow] = useState(null);

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

  // ฟังก์ชันเปิด modal ลบ
  const openDeleteModal = (docNumber) => {
    setSelectedDocNumber(docNumber);
    setDeleteReason("");
    setIsDeleteModalOpen(true);
  };

  // ฟังก์ชันขอลบ (ส่ง request)
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
    }
  };

  const openEditModal = (docNumber, currentNote) => {
    setSelectedDocNumber(docNumber);
    setEditNote(currentNote || "");
    setIsModalOpen(true);
  };

  const handleSaveNote = async () => {
    try {
      const employee = session?.user?.name || "";
      const message = `พนักงาน ${employee} ขอแก้ไขหมายเหตุของรายการ ${selectedDocNumber}`;

      await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/Notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          docNumber: selectedDocNumber,
          employee,
          message,
          type: "editRequest",
          details: {
            afterNote: editNote,
          },
        }),
      });

      alert("ส่งคำขอแก้ไขเรียบร้อยแล้ว");
    } catch (error) {
      console.error("Error sending edit notification:", error);
      alert("เกิดข้อผิดพลาดในการส่งคำขอ");
    } finally {
      setIsModalOpen(false);
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
                  <Link href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/buying`}>
                    <button className="bg-green-500 text-white py-2 px-3 rounded-md text-lg hover:bg-green-600">
                      Buy
                    </button>
                  </Link>
                  <Link href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/selling`}>
                    <button className="bg-green-500 text-white py-2 px-3 rounded-md text-lg hover:bg-green-600">
                      Sell
                    </button>
                  </Link>
                  <Link href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/wechat`}>
                    <button className="bg-blue-500 text-white py-2 px-3 rounded-md text-lg hover:bg-blue-600">
                      Wechat
                    </button>
                  </Link>
                  <Link href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/withdraw`}>
                    <button className="bg-blue-500 text-white py-2 px-3 rounded-md text-lg hover:bg-blue-600">
                      Withdraw
                    </button>
                  </Link>
                  <Link href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/lot`}>
                    <button className="bg-purple-500 text-white py-2 px-3 rounded-md text-lg hover:bg-purple-600">
                      Lot
                    </button>
                  </Link>
                </div>
                <button
                  onClick={getRecords}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
                >
                  🔄 รีเฟรชข้อมูล
                </button>
              </div>

              <table className="w-full border">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border px-3 py-2 cursor-pointer" onClick={() => handleSort('docNumber')}>
                      เลขที่รายการ {sortKey === 'docNumber' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                    <th className="border px-3 py-2 cursor-pointer" onClick={() => handleSort('createdAt')}>
                      เวลา {sortKey === 'createdAt' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                    <th className="border px-3 py-2 cursor-pointer" onClick={() => handleSort('total')}>
                      ยอดรวม {sortKey === 'total' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                    <th className="border px-3 py-2 cursor-pointer" onClick={() => handleSort('payType')}>
                      ประเภท {sortKey === 'payType' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRecords.map((record, index) => {
                    const isSelected = selectedRow === index;
                    return (
                      <React.Fragment key={index}>
                        <tr
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRow(index === selectedRow ? null : index);
                          }}
                          className={`text-center cursor-pointer ${
                            record.payType === "Buying"
                              ? "text-green-600"
                              : record.payType === "Selling"
                              ? "text-orange-500"
                              : "text-black"
                          } ${isSelected ? "bg-yellow-100" : ""}`}
                        >
                          <td className="border px-3 py-1">{record.docNumber}</td>
                          <td className="border px-3 py-1">
                            {format(new Date(record.createdAt), "HH:mm:ss")}
                          </td>
                          <td className="border px-3 py-1">
                            {Number(record.total).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td className="border px-3 py-1">{record.payType}</td>
                        </tr>
                        {isSelected && (
                          <tr className="bg-gray-100">
                            <td colSpan={4} className="py-2 text-center">
                              <div className="flex justify-center gap-3">
                                <button
                                  onClick={() => {
                                    window.open(
                                      `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/printreceipt?docNumber=${record.docNumber}&total=${record.total}`,
                                      "_blank",
                                      "width=500,height=400"
                                    );
                                  }}
                                  className="bg-gray-800 text-white px-3 py-1 rounded hover:bg-gray-700 text-sm"
                                >
                                  Print
                                </button>
                                <button
                                  onClick={() => openDeleteModal(record.docNumber)}
                                  className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 text-sm"
                                >
                                  ลบ?
                                </button>
                                <button
                                  onClick={() => openEditModal(record.docNumber, record.note)}
                                  className="bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600 text-sm"
                                >
                                  แก้ไข
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <Footer />
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-5 rounded shadow-lg w-80">
            <h2 className="text-lg font-semibold mb-3">แก้ไขรายละเอียด</h2>
            <textarea
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              className="w-full h-24 p-2 border border-gray-300 rounded mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-3 py-1 bg-gray-400 text-white rounded"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSaveNote}
                className="px-3 py-1 bg-green-600 text-white rounded"
              >
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-5 rounded shadow-lg w-80">
            <h2 className="text-lg font-semibold mb-3">ขออนุมัติลบรายการ</h2>
            <textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              className="w-full h-24 p-2 border border-gray-300 rounded mb-4"
              placeholder="โปรดระบุเหตุผล"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-3 py-1 bg-gray-400 text-white rounded"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleRequestDelete}
                className="px-3 py-1 bg-red-600 text-white rounded"
              >
                แจ้งขอลบ
              </button>
            </div>
          </div>
        </div>
      )}
    </Container>
  );
}

export default WelcomePage;

"use client";

import React, { useState, useEffect } from "react";
import AdminNav from "../components/AdminNav";
import Footer from "../components/Footer";
import AdminLayout from "../components/AdminLayout";
import Container from "../components/Container";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import DeleteBtn from "./DeleteBtn";
import { useRouter } from "next/navigation";

function AdminUserManagePage() {
  const router = useRouter();

  const { data: session } = useSession();
  if (!session) redirect(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/login`);
  if (!session?.user?.role === "admin")
    redirect(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/welcome`);

  const [allUsersData, setAllUsersData] = useState([]);
  const [expandedRow, setExpandedRow] = useState(null);

  console.log("allUsersData: ", allUsersData);

  const getAllUsersData = async () => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/totalusers`,
        {
          cache: "no-store",
        }
      );

      if (!res.ok) {
        throw new Error("Failed to fetch user");
      }

      const data = await res.json();
      setAllUsersData(data.totalUsers);
    } catch (error) {
      console.log("Error loading users: ", error);
    }
  };

  useEffect(() => {
    getAllUsersData();
  }, []);

  return (
    <Container>
      <div className="hidden md:block">
        <AdminNav session={session} />
      </div>
      <div className="flex-grow">
        <AdminLayout session={session}>
          <div className="p-10">
            <h3 className="text-3xl mb-3">ผู้ใช้งาน</h3>
            <div className="flex justify-end mb-4">
              <button
                onClick={() =>
                  router.push(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/register`)
                }
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
              >
                เพิ่มผู้ใช้
              </button>
            </div>

            {/* Mobile View */}
            <div className="md:hidden space-y-4">
              {allUsersData?.map((val, index) => (
                <div
                  key={val._id}
                  className="border rounded p-4 shadow"
                  onClick={() => setExpandedRow(expandedRow === index ? null : index)}
                >
                  <div><strong>ชื่อพนักงาน:</strong> {val.name}</div>
                  <div><strong>Username:</strong> {val.email}</div>
                  <div><strong>Role:</strong> {val.role}</div>
                  <div><strong>สาขา:</strong> {val.branch}</div>
                  <div><strong>ประเทศ:</strong> {val.country}</div>
                  {expandedRow === index && (
                    <div className="flex gap-3 mt-4">
                      <Link
                        href={`${
                          process.env.NEXT_PUBLIC_BASE_PATH || ""
                        }/admin/users/edit/${val._id}`}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md shadow hover:bg-blue-700 transition"
                      >
                        ✏️ แก้ไข
                      </Link>
                      <DeleteBtn id={val._id} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-md shadow hover:bg-red-700 transition" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop View */}
            <div className="shadow-lg overflow-x-auto">
              <table className="hidden md:table text-left rounded-md mt-3 w-full">
                <thead>
                  <tr className="bg-gray-400">
                    <th className="p-5">ชื่อพนักงาน</th>
                    <th className="p-5">Username</th>
                    <th className="p-5">Role</th>
                    <th className="p-5">สาขา</th>
                    <th className="p-5">ประเทศ</th>
                    <th className="p-5">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allUsersData?.map((val) => (
                    <tr key={val._id}>
                      <td className="p-5">{val.name}</td>
                      <td className="p-5">{val.email}</td>
                      <td className="p-5">{val.role}</td>
                      <td className="p-5">{val.branch}</td>
                      <td className="p-5">{val.country}</td>
                      <td className="p-5">
                        <Link
                          className="bg-gray-500 text-white border py-2 px-3 rounded text-lg my-2"
                          href={`${
                            process.env.NEXT_PUBLIC_BASE_PATH || ""
                          }/admin/users/edit/${val._id}`}
                        >
                          Edit
                        </Link>
                        <DeleteBtn id={val._id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </AdminLayout>
      </div>
      <Footer />
    </Container>
  );
}

export default AdminUserManagePage;

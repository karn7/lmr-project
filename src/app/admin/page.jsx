"use client"

import React, { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Label, LabelList, PieChart, Pie, Cell } from 'recharts';
import AdminNav from './components/AdminNav'
import Container from './components/Container'
import Footer from './components/Footer'
import Content from './components/Content'
import AdminLayout from './components/AdminLayout';

import { useSession, signOut } from 'next-auth/react'
import { redirect } from 'next/navigation'

function AdminPage() {

    const { data: session } = useSession();
    
    useEffect(() => {
      if (!session) {
        redirect(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/login`);
      } else if (session?.user?.role !== "admin") {
        redirect(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/welcome`);
      } else if (session?.user?.lastLoginDate) {
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

    const [totalUsersData, setTotalUsersData] = useState([]);
    const [totalPostsData, setTotalPostsData] = useState([]);

    // Dashboard data for 7 days chart
    const [dashboardData, setDashboardData] = useState([]);
    const [branches, setBranches] = useState([]);
    const [payTypes, setPayTypes] = useState([]);
    const [selectedBranch, setSelectedBranch] = useState("all");

    const [selectedDate, setSelectedDate] = useState(() => {
      const today = new Date();
      return today.toISOString().split("T")[0];
    });

    const [viewMode, setViewMode] = useState("7days");

    useEffect(() => {
      const fetchDashboardData = async () => {
        try {
          const [dataRes, branchesRes] = await Promise.all([
            fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/dashboard/7days?mode=${viewMode}&start=${selectedDate}`, {
              cache: "no-store"
            }),
            fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/dashboard/7days?mode=branches`, {
              cache: "no-store"
            })
          ]);

          const dataJson = await dataRes.json();
          const branchesJson = await branchesRes.json();

          setDashboardData(dataJson.data);
          setBranches(branchesJson.branches || []);
          setPayTypes(dataJson.types || []);
        } catch (error) {
          console.log("Error loading dashboard data: ", error);
        }
      };
      fetchDashboardData();
    }, [selectedDate, viewMode]);

    console.log(totalUsersData)
    console.log(totalPostsData)

    const getTotalUsers = async () => {
        try {

            const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/totalusers`, {
                cache: "no-store"
            })

            if (!res.ok) {
                throw new Error("Failed to fetch user");
            }

            const data = await res.json();
            setTotalUsersData(data.totalUsers);

        } catch(error) {
            console.log("Error loading users: ", error);
        }
    }

    const getTotalPosts = async () => {
        try {

            const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/totalposts`, {
                cache: "no-store"
            })

            if (!res.ok) {
                throw new Error("Failed to fetch posts");
            }

            const data = await res.json();
            setTotalPostsData(data.totalPosts);

        } catch(error) {
            console.log("Error loading posts: ", error);
        }
    }

    useEffect(() => {
        getTotalUsers();
        getTotalPosts();
    }, [])

    const transformedData = dashboardData.map(item => ({
      date: item.date,
      total: item.total,
      ...item.branches
    }));

    const filteredPayTypes = selectedBranch === "all"
      ? payTypes
      : payTypes.map(type => ({
          _id: type._id,
          count: type[selectedBranch] || 0
        }));

  return (
    <Container>
        <div className="hidden md:block">
  <AdminNav session={session} />
</div>
        <div className="flex-grow">
          <AdminLayout>
            <div className="p-4 mb-6 bg-white rounded-lg shadow">
              <h2 className="text-xl font-bold mb-4 text-gray-800">จำนวนรายการย้อนหลัง 7 วัน</h2>
              <div className="w-full h-[250px] md:h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={transformedData} margin={{ top: 30, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        const month = `${date.getMonth() + 1}`.padStart(2, "0");
                        const day = `${date.getDate()}`.padStart(2, "0");
                        return `${month}-${day}`;
                      }}
                    >
                      <Label position="insideBottom" offset={-20} style={{ fill: '#000', fontSize: 12 }} />
                    </XAxis>
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {/* รวมทั้งหมด */}
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="#000000"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    >
                      <LabelList dataKey="total" position="top" />
                    </Line>
                    {/* แยกตามสาขา */}
                    {branches.map((branch, index) => (
                      <Line
                        key={branch}
                        type="monotone"
                        dataKey={branch}
                        stroke={`hsl(${index * 60}, 70%, 50%)`}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      >
                        <LabelList dataKey={branch} position="top" />
                      </Line>
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="p-4 mb-6 bg-white rounded-lg shadow">
              <h2 className="text-xl font-bold mb-2 text-gray-800">ประเภทรายการ</h2>
              <div className="mb-4 flex flex-wrap items-center gap-4">
                <div>
                  <button
                    className={`px-3 py-1 text-sm rounded ${viewMode === "7days" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
                    onClick={() => setViewMode("7days")}
                  >
                    ดู 7 วันที่ผ่านมา
                  </button>
                  <button
                    className={`ml-2 px-3 py-1 text-sm rounded ${viewMode === "daily" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
                    onClick={() => setViewMode("daily")}
                  >
                    ดูรายวัน
                  </button>
                </div>
                {viewMode === "daily" && (
                  <div>
                    <label className="mr-2 text-sm text-gray-700">เลือกวันที่:</label>
                    <input
                      type="date"
                      className="border px-2 py-1 text-sm"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      max={new Date().toISOString().split("T")[0]}
                    />
                  </div>
                )}
              </div>
              <div className="flex flex-col md:flex-row items-start gap-4">
                <div className="w-full md:w-1/2">
                  <div className="mb-4">
                    <label className="mr-2 text-sm text-gray-700">เลือกสาขา:</label>
                    <select
                      className="border px-2 py-1 text-sm"
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                    >
                      <option value="all">ทั้งหมด</option>
                      {branches.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-full h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                        <Pie
                          data={filteredPayTypes}
                          dataKey="count"
                          nameKey="_id"
                          outerRadius={60}
                          fill="#8884d8"
                          label={({ name, value }) => `${value}`}
                          labelLine
                        >
                          {filteredPayTypes.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={`hsl(${index * 70}, 70%, 50%)`} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="w-full md:w-1/2">
                  {/* future content */}
                </div>
              </div>
            </div>
          </AdminLayout>
        </div>
        <Footer />
    </Container>
  )
}

export default AdminPage
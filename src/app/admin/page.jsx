"use client"

import React, { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Label, LabelList, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import AdminNav from './components/AdminNav'
import Container from './components/Container'
import Footer from './components/Footer'
import Content from './components/Content'
import AdminLayout from './components/AdminLayout';

import { useSession, signOut } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { useRouter } from 'next/navigation';

function AdminPage() {

    const { data: session } = useSession();
    const router = useRouter();
    
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
    // State สำหรับวันที่ของกราฟค่าธรรมเนียม
    const [selectedFeeDate, setSelectedFeeDate] = useState(() => {
      const today = new Date();
      return today.toISOString().split("T")[0];
    });

    const [viewMode, setViewMode] = useState("7days");

    const [feeByBranch, setFeeByBranch] = useState([]);

    const [cashTotalByCurrency, setCashTotalByCurrency] = useState({});

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
          setPayTypes(dataJson.typesByBranch || []);
        } catch (error) {
          console.log("Error loading dashboard data: ", error);
        }
      };
      fetchDashboardData();
    }, [selectedDate, viewMode]);

    // ใช้ฟังก์ชัน fetchAllTodayBalances สำหรับดึงยอดเงินสดแต่ละวัน
    const fetchAllTodayBalances = async (targetDate) => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/shifts`,
          { cache: "no-store" }
        );
        const data = await res.json();
        const allShifts = data.shifts || [];
        const balances = allShifts.filter(s => s.date === targetDate);
        return balances;
      } catch (err) {
        console.error("Error fetching cash balances today", err);
        return [];
      }
    };

    useEffect(() => {
      const loadCashBalances = async () => {
        const today = new Date().toISOString().split("T")[0];
        const balances = await fetchAllTodayBalances(today);
        const totals = {};
        balances.forEach(branch => {
          Object.entries(branch.cashBalance || {}).forEach(([currency, amount]) => {
            if (!totals[currency]) totals[currency] = 0;
            totals[currency] += Number(amount) || 0;
          });
        });
        setCashTotalByCurrency(totals);
      };
      loadCashBalances();
    }, [selectedDate]);

    useEffect(() => {
      const fetchFees = async () => {
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/dashboard/fees?date=${selectedFeeDate}`, {
            cache: "no-store",
          });
          const data = await res.json();
          setFeeByBranch(data?.data || []);
        } catch (err) {
          console.error("Error fetching fee summary", err);
        }
      };
      fetchFees();
    }, [selectedFeeDate]);

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

    // รวมยอดตามสกุลเงินจากทุกสาขา
    // const totalByCurrency = {};
    // dashboardData.forEach(item => {
    //   if (item.totalBalance) {
    //     Object.entries(item.totalBalance).forEach(([currency, amount]) => {
    //       if (!totalByCurrency[currency]) totalByCurrency[currency] = 0;
    //       totalByCurrency[currency] += amount;
    //     });
    //   }
    // });

    const filteredPayTypes = React.useMemo(() => {
      if (selectedBranch === "all") {
        const filtered = viewMode === "daily"
          ? payTypes.filter(entry => entry._id.date === selectedDate)
          : payTypes;

        const merged = {};
        filtered.forEach(entry => {
          const key = entry._id.payType;
          if (!merged[key]) {
            merged[key] = {
              _id: entry._id.payType,
              count: 0,
            };
          }
          Object.entries(entry).forEach(([k, v]) => {
            if (branches.includes(k)) {
              merged[key].count += v;
            }
          });
        });

        return Object.values(merged).filter(e => e.count > 0);
      } else {
        const daily = payTypes
          .filter(entry => entry._id.date === selectedDate && (selectedBranch === "all" || entry[selectedBranch]))
          .map(entry => ({
            _id: entry._id.payType,
            count: selectedBranch === "all"
              ? branches.reduce((sum, branch) => sum + (entry[branch] || 0), 0)
              : (entry[selectedBranch] || 0)
          }))
          .filter(item => item.count > 0);
        return daily;
      }
    }, [payTypes, selectedBranch, selectedDate, viewMode]);

    // Responsive outerRadius for Pie chart
    const [outerRadius, setOuterRadius] = useState(100);

    useEffect(() => {
      const updateRadius = () => {
        const width = window.innerWidth;
        if (width < 768) {
          setOuterRadius(80);
        } else {
          setOuterRadius(100);
        }
      };

      updateRadius();
      window.addEventListener("resize", updateRadius);
      return () => window.removeEventListener("resize", updateRadius);
    }, []);

  return (
    <Container>
        <div className="hidden md:block">
  <AdminNav session={session} />
</div>
        <div className="flex-grow">
          <AdminLayout>
            {/* กรอบยอดรวมเงินวันนี้ (รวมทุกสาขา) */}
            <div className="p-4 mb-6 bg-white rounded-lg shadow">
              <h2 className="text-xl font-bold mb-4 text-gray-800">ยอดรวมเงินวันนี้ (รวมทุกสาขา)</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-2 text-sm text-gray-800">
                {Object.entries(cashTotalByCurrency).map(([currency, amount]) => (
                  <div key={currency} className={amount < 0 ? "text-red-600" : ""}>
                    <span className="font-medium">{currency}:</span>{" "}
                    {amount.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).replace(/\.00$/, ".-")}
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <button
                  onClick={() => router.push("/admin/cash")}
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                >
                  ดูรายละเอียด
                </button>
              </div>
            </div>
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="w-full md:w-1/2">
                <div className="p-4 bg-white rounded-lg shadow">
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
              </div>
              <div className="w-full md:w-1/2">
                <div className="p-4 bg-white rounded-lg shadow">
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
                      (() => {
                        const maxDate = new Date().toISOString().split("T")[0];
                        const minDateObj = new Date();
                        minDateObj.setDate(minDateObj.getDate() - 6);
                        const minDate = minDateObj.toISOString().split("T")[0];
                        return (
                          <div>
                            <label className="mr-2 text-sm text-gray-700">เลือกวันที่:</label>
                            <input
                              type="date"
                              className="border px-2 py-1 text-sm"
                              value={selectedDate}
                              onChange={(e) => setSelectedDate(e.target.value)}
                              min={minDate}
                              max={maxDate}
                            />
                          </div>
                        );
                      })()
                    )}
                  </div>
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
                  <div className="w-full flex flex-col md:flex-row h-[250px] md:h-[270px]">
                    <div className="w-full md:w-1/3 text-sm pr-4 overflow-y-auto">
                      {filteredPayTypes.map((entry, index) => (
                        <div key={index} className="flex items-center mb-1">
                          <span
                            className="inline-block w-3 h-3 mr-2 rounded-full"
                            style={{ backgroundColor: `hsl(${index * 70}, 70%, 50%)` }}
                          ></span>
                          {entry._id}
                        </div>
                      ))}
                    </div>
                    <div className="w-full md:w-2/3 h-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Tooltip
                            formatter={(value, name) => [`${value} รายการ`, `${name}`]}
                            labelFormatter={() => ""}
                            contentStyle={{ fontSize: "0.85rem" }}
                          />
                          <Pie
                            data={filteredPayTypes}
                            dataKey="count"
                            nameKey="_id"
                            outerRadius={outerRadius}
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
                </div>
              </div>
            </div>
            {/* ค่าธรรมเนียมรวมแยกตามสาขา */}
            <div className="p-4 mt-6 bg-white rounded-lg shadow">
              <div className="mb-4">
                <label className="mr-2 text-sm text-gray-700">เลือกวันที่:</label>
                <input
                  type="date"
                  className="border px-2 py-1 text-sm"
                  value={selectedFeeDate}
                  onChange={(e) => setSelectedFeeDate(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                />
              </div>
              <h2 className="text-xl font-bold mb-4 text-gray-800">ค่าธรรมเนียมรวมแยกตามสาขา</h2>
              <div className="flex flex-col md:flex-row gap-6">
                {
                  // Define branch color generator and color map outside the map
                  (() => {
                    const branchColors = {};
                    const getBranchColor = (branch) => {
                      if (!branchColors[branch]) {
                        const hue = Object.keys(branchColors).length * 60 % 360;
                        branchColors[branch] = `hsl(${hue}, 70%, 50%)`;
                      }
                      return branchColors[branch];
                    };
                    return ["THB", "LAK"].map((currency, idx) => {
                      const total = feeByBranch
                        .filter(f => f.currency === currency)
                        .reduce((sum, item) => sum + item.totalFee, 0);
                      return (
                        <div key={currency} className="w-full md:w-1/2">
                          <h3 className="text-md font-semibold mb-2 text-gray-700">สกุลเงิน: {currency}</h3>
                          <p className="text-lg font-bold mb-4 text-blue-700">
                            รวมทั้งหมด: {total.toLocaleString()} {currency}
                          </p>
                          <div className="w-full h-[250px] md:h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={feeByBranch.filter(f => f.currency === currency)}
                                margin={{ top: 30, right: 30, left: 0, bottom: 0 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="branch">
                                  <Label value="" position="insideBottom" offset={-5} />
                                </XAxis>
                                <YAxis />
                                <Tooltip formatter={(value) => `${value.toLocaleString()} ${currency}`} />
                                <Legend />
                                <Bar dataKey="totalFee">
                                  {feeByBranch
                                    .filter(f => f.currency === currency)
                                    .map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={getBranchColor(entry.branch)} />
                                    ))}
                                  <LabelList 
                                    dataKey="totalFee" 
                                    position="top" 
                                    formatter={(v) => v.toLocaleString()}
                                    style={{ fontWeight: 'bold', fill: '#1D4ED8' }} 
                                  />
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      );
                    });
                  })()
                }
              </div>
            </div>
          </AdminLayout>
        </div>
        <Footer />
    </Container>
  )
}

export default AdminPage
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import AdminNav from "../components/AdminNav";
import AdminLayout from "../components/AdminLayout";
import Container from "../components/Container";
import Footer from "../components/Footer";

const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
const money = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function contactEntries(contactInfo) {
  if (!contactInfo) return [];
  if (typeof contactInfo !== "object" || Array.isArray(contactInfo)) {
    return [["ข้อมูลติดต่อ", String(contactInfo)]];
  }

  const labels = {
    phone: "เบอร์โทรศัพท์",
    phoneNumber: "เบอร์โทรศัพท์",
    mobile: "โทรศัพท์มือถือ",
    email: "อีเมล",
    address: "ที่อยู่",
    line: "LINE",
    lineId: "LINE ID",
  };

  return Object.entries(contactInfo)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => [
      labels[key] || key,
      typeof value === "object" ? JSON.stringify(value) : String(value),
    ]);
}

function statusText(value) {
  if (!value) return "-";
  const labels = { active: "ปกติ", inactive: "ไม่ใช้งาน", normal: "ปกติ", low: "ต่ำ", medium: "ปานกลาง", high: "สูง", blocked: "ระงับ" };
  return labels[String(value).toLowerCase()] || value;
}

export default function AdminCustomersPage() {
  const { data: session, status } = useSession();
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (status === "unauthenticated") redirect(`${base}/login`);
  if (status === "authenticated" && session?.user?.role !== "admin") redirect(`${base}/welcome`);

  async function searchCustomers(event) {
    event?.preventDefault();
    const keyword = query.trim();
    if (!keyword) return;
    setLoading(true);
    setError("");
    setSuccess("");
    setSelectedId("");
    setDetail(null);
    try {
      const response = await fetch(`${base}/api/customers?q=${encodeURIComponent(keyword)}&limit=50`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "ค้นหาข้อมูลไม่สำเร็จ");
      setCustomers(data.items || []);
    } catch (err) {
      setCustomers([]);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    async function loadDetail() {
      setDetailLoading(true);
      setError("");
      try {
        const response = await fetch(`${base}/api/customers/${selectedId}?page=${page}&limit=20`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "โหลดข้อมูลลูกค้าไม่สำเร็จ");
        if (!cancelled) setDetail(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    }
    loadDetail();
    return () => { cancelled = true; };
  }, [selectedId, page]);

  function selectCustomer(id) {
    setSelectedId(id);
    setPage(1);
    setSuccess("");
  }

  async function deleteCustomer() {
    if (!detail?.customer) return;
    const customer = detail.customer;
    const transactionMessage = detail.summary.transactionCount > 0
      ? `\n\nลูกค้ารายนี้มีประวัติ ${detail.summary.transactionCount} รายการ ซึ่งจะยังคงเก็บไว้ในระบบ`
      : "";
    const confirmed = window.confirm(
      `ยืนยันลบข้อมูลลูกค้า “${customer.fullName}” (${customer.idNumber}) หรือไม่?${transactionMessage}\n\nการลบโปรไฟล์นี้ไม่สามารถย้อนกลับได้`
    );
    if (!confirmed) return;

    setDeleting(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`${base}/api/customers/${customer.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "ลบข้อมูลลูกค้าไม่สำเร็จ");

      setCustomers((current) => current.filter((item) => item.id !== customer.id));
      setSelectedId("");
      setDetail(null);
      setPage(1);
      setSuccess(data.message || "ลบข้อมูลลูกค้าเรียบร้อยแล้ว");
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Container>
      <div className="hidden md:block"><AdminNav session={session} /></div>
      <div className="flex-grow">
        <AdminLayout>
          <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <h1 className="text-3xl font-semibold mb-2">ข้อมูลลูกค้า</h1>
            <p className="text-gray-600 mb-6">ค้นหาด้วยชื่อ นามสกุล หรือเลขบัตรประชาชน/พาสปอร์ต</p>

            <form onSubmit={searchCustomers} className="flex flex-col sm:flex-row gap-3 mb-6">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="เช่น สมชาย, ใจดี หรือ 1234567890123"
                className="flex-1 border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button disabled={loading || !query.trim()} className="bg-blue-600 text-white rounded-lg px-6 py-3 disabled:opacity-50">
                {loading ? "กำลังค้นหา..." : "ค้นหา"}
              </button>
            </form>

            {error && <div className="mb-5 rounded-lg bg-red-50 text-red-700 p-4">{error}</div>}
            {success && <div className="mb-5 rounded-lg bg-green-50 text-green-700 p-4">{success}</div>}

            {customers.length > 0 && (
              <div className="bg-white border rounded-xl overflow-hidden mb-6">
                <div className="px-4 py-3 bg-gray-50 font-semibold">ผลการค้นหา ({customers.length} รายการ)</div>
                <div className="divide-y">
                  {customers.map((customer) => (
                    <button key={customer.id} onClick={() => selectCustomer(customer.id)} className={`w-full text-left p-4 hover:bg-blue-50 ${selectedId === customer.id ? "bg-blue-50 ring-1 ring-inset ring-blue-300" : ""}`}>
                      <div className="font-semibold text-gray-900">{customer.fullName}</div>
                      <div className="text-sm text-gray-600 mt-1">{customer.idType === "thai_id" ? "บัตรประชาชน" : "พาสปอร์ต"}: {customer.idNumber} · สัญชาติ {customer.nationality}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {!loading && query.trim() && customers.length === 0 && !error && <div className="text-center text-gray-500 py-8">ไม่พบข้อมูลลูกค้า</div>}

            {detailLoading && <div className="text-center py-8 text-gray-500">กำลังโหลดรายละเอียด...</div>}
            {detail && !detailLoading && (
              <div className="space-y-6">
                <section className="bg-white border rounded-xl p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <h2 className="text-xl font-semibold">ข้อมูลส่วนตัว</h2>
                    <button
                      type="button"
                      onClick={deleteCustomer}
                      disabled={deleting}
                      className="self-start rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleting ? "กำลังลบ..." : "ลบข้อมูลลูกค้า"}
                    </button>
                  </div>
                  <dl className="grid md:grid-cols-3 gap-4 text-sm">
                    <div><dt className="text-gray-500">ชื่อ–นามสกุล</dt><dd className="font-medium mt-1">{detail.customer.fullName}</dd></div>
                    <div><dt className="text-gray-500">ประเภทเอกสาร</dt><dd className="font-medium mt-1">{detail.customer.idType === "thai_id" ? "บัตรประชาชน" : "พาสปอร์ต"}</dd></div>
                    <div><dt className="text-gray-500">เลขเอกสาร</dt><dd className="font-medium mt-1">{detail.customer.idNumber}</dd></div>
                    <div><dt className="text-gray-500">สัญชาติ</dt><dd className="font-medium mt-1">{detail.customer.nationality}</dd></div>
                    <div><dt className="text-gray-500">สาขา</dt><dd className="font-medium mt-1">{detail.customer.branch || "-"}</dd></div>
                    <div><dt className="text-gray-500">สถานะ</dt><dd className={`font-medium mt-1 ${detail.customer.isActive ? "text-green-700" : "text-red-700"}`}>{detail.customer.isActive ? "ใช้งาน" : "ระงับ"}</dd></div>
                    <div><dt className="text-gray-500">สถานะลูกค้า</dt><dd className="font-medium mt-1">{statusText(detail.customer.customerStatus)}</dd></div>
                    <div><dt className="text-gray-500">ระดับความเสี่ยง</dt><dd className="font-medium mt-1">{statusText(detail.customer.riskStatus)}</dd></div>
                    <div><dt className="text-gray-500">วันหมดอายุเอกสาร</dt><dd className="font-medium mt-1">{formatDate(detail.customer.documentExpiresAt)}</dd></div>
                    <div><dt className="text-gray-500">วันที่เก็บข้อมูล</dt><dd className="font-medium mt-1">{formatDate(detail.customer.dataCollectedAt)}</dd></div>
                    <div><dt className="text-gray-500">ผู้บันทึก</dt><dd className="font-medium mt-1">{detail.customer.createdBy || "-"}</dd></div>
                    <div><dt className="text-gray-500">สร้างเมื่อ</dt><dd className="font-medium mt-1">{formatDate(detail.customer.createdAt)}</dd></div>
                    <div className="md:col-span-3"><dt className="text-gray-500">หมายเหตุ</dt><dd className="font-medium mt-1 whitespace-pre-wrap">{detail.customer.notes || "-"}</dd></div>
                  </dl>
                </section>

                <section className="bg-white border rounded-xl p-5">
                  <h2 className="text-xl font-semibold mb-4">ข้อมูลติดต่อ</h2>
                  {contactEntries(detail.customer.contactInfo).length > 0 ? (
                    <dl className="grid md:grid-cols-2 gap-4 text-sm">
                      {contactEntries(detail.customer.contactInfo).map(([label, value], index) => (
                        <div key={`${label}-${index}`}>
                          <dt className="text-gray-500">{label}</dt>
                          <dd className="font-medium mt-1 whitespace-pre-wrap break-words">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : <p className="text-gray-500">ไม่มีข้อมูลติดต่อ</p>}
                </section>

                <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    ["รายการทั้งหมด", `${detail.summary.transactionCount} รายการ`],
                    ["ยอดรวม", money.format(detail.summary.totalAmount)],
                    ["รายการซื้อ / ขาย", `${detail.summary.buyingCount} / ${detail.summary.sellingCount}`],
                    ["ทำรายการล่าสุด", formatDate(detail.summary.lastTransactionAt)],
                  ].map(([label, value]) => <div key={label} className="border rounded-xl p-4 bg-white"><div className="text-sm text-gray-500">{label}</div><div className="text-xl font-semibold mt-2">{value}</div></div>)}
                </section>

                <section className="bg-white border rounded-xl overflow-hidden">
                  <h2 className="text-xl font-semibold p-5">ประวัติธุรกรรม</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-100"><tr><th className="p-3">วันที่</th><th className="p-3">เลขที่เอกสาร</th><th className="p-3">ประเภท</th><th className="p-3">สาขา</th><th className="p-3 text-right">ยอดรวม</th><th className="p-3">พนักงาน</th></tr></thead>
                      <tbody className="divide-y">
                        {detail.records.map((record) => (
                          <tr key={record._id} className="hover:bg-gray-50">
                            <td className="p-3 whitespace-nowrap">{formatDate(record.createdAt)}</td>
                            <td className="p-3"><Link className="text-blue-600 hover:underline" href={`${base}/admin/report/daily/dailylist/${record.docNumber}`}>{record.docNumber || "-"}</Link></td>
                            <td className="p-3">{record.payType || "-"}</td><td className="p-3">{record.branch || "-"}</td>
                            <td className="p-3 text-right">{money.format(record.total || 0)}</td><td className="p-3">{record.employee || "-"}</td>
                          </tr>
                        ))}
                        {detail.records.length === 0 && <tr><td colSpan="6" className="p-8 text-center text-gray-500">ยังไม่มีประวัติธุรกรรม</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  {detail.pagination.pages > 1 && <div className="p-4 border-t flex justify-between items-center"><button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1} className="border rounded px-4 py-2 disabled:opacity-40">ก่อนหน้า</button><span>หน้า {page} จาก {detail.pagination.pages}</span><button onClick={() => setPage((value) => Math.min(detail.pagination.pages, value + 1))} disabled={page === detail.pagination.pages} className="border rounded px-4 py-2 disabled:opacity-40">ถัดไป</button></div>}
                </section>
              </div>
            )}
          </div>
        </AdminLayout>
      </div>
      <Footer />
    </Container>
  );
}

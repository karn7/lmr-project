import React, { useState } from 'react';
import Link from 'next/link';

function SideNav({ collapsed }) {
  const [showReportSubMenu, setShowReportSubMenu] = useState(false);
  const [showStockSubMenu, setShowStockSubMenu] = useState(false);
  const [showAuditSubMenu, setShowAuditSubMenu] = useState(false);

  return (
    <nav className='shadow-lg p-10 rounded-lg'>
      <ul>
        <li>
          <Link
            href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/admin`}
            className="flex items-center gap-3 my-3 p-3 rounded-lg hover:bg-gray-100"
          >
            <span>🏠</span>
            {!collapsed && <span>Dashboard</span>}
          </Link>
        </li>
        <li>
          <Link
            href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/admin/users`}
            className="flex items-center gap-3 my-3 p-3 rounded-lg hover:bg-gray-100"
          >
            <span>👥</span>
            {!collapsed && <span>Users</span>}
          </Link>
        </li>
        <li>
          <Link
            href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/admin/rateadmin`}
            className="flex items-center gap-3 my-3 p-3 rounded-lg hover:bg-gray-100"
          >
            <span>💱</span>
            {!collapsed && <span>Rate</span>}
          </Link>
        </li>
        <li>
          <button
            className="flex items-center gap-3 w-full text-left my-3 p-3 rounded-lg hover:bg-gray-100"
            onClick={() => setShowReportSubMenu(!showReportSubMenu)}
          >
            <span>📊</span>
            {!collapsed && <span>Report</span>}
            {!collapsed && (
              <span className="ml-auto">{showReportSubMenu ? '▲' : '▼'}</span>
            )}
          </button>
          {showReportSubMenu && (
            <ul className="ml-8 text-sm text-gray-700">
              <li>
                <Link
                  href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/admin/report/daily`}
                  className="flex items-center gap-3 my-2 p-2 rounded-lg hover:bg-gray-100"
                >
                  <span>📊</span>
                  {!collapsed && <span>รายงานประจำวัน</span>}
                </Link>
              </li>
              <li>
                <Link
                  href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/admin/report/cash-drawer`}
                  className="flex items-center gap-3 my-2 p-2 rounded-lg hover:bg-gray-100"
                >
                  <span>📊</span>
                  {!collapsed && <span>รายงานลิ้นชักเก็บเงิน</span>}
                </Link>
              </li>
              <li>
                <Link
                  href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/admin/report/shift-summary`}
                  className="flex items-center gap-3 my-2 p-2 rounded-lg hover:bg-gray-100"
                >
                  <span>📊</span>
                  {!collapsed && <span>รายงานเปิดปิดร้าน</span>}
                </Link>
              </li>
              <li>
                <Link
                  href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/admin/report/lottery`}
                  className="flex items-center gap-3 my-2 p-2 rounded-lg hover:bg-gray-100"
                >
                  <span>🎟️</span>
                  {!collapsed && <span>รายงาน Lottery</span>}
                </Link>
              </li>
              <li>
  <Link
    href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/admin/report/deposit`}
    className="flex items-center gap-3 my-2 p-2 rounded-lg hover:bg-gray-100"
  >
    <span>🏦</span>
    {!collapsed && <span>รายงาน Deposit</span>}
  </Link>
</li>
              <li>
                <Link
                  href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/admin/report/bot-exchange`}
                  className="flex items-center gap-3 my-2 p-2 rounded-lg hover:bg-gray-100"
                >
                  <span>🏦</span>
                  {!collapsed && <span>รายงาน BOT Exchange</span>}
                </Link>
              </li>
            </ul>
          )}
        </li>
        <li>
          <button
            className="flex items-center gap-3 w-full text-left my-3 p-3 rounded-lg hover:bg-gray-100"
            onClick={() => setShowStockSubMenu(!showStockSubMenu)}
          >
            <span>📦</span>
            {!collapsed && <span>Stocks</span>}
            {!collapsed && (
              <span className="ml-auto">{showStockSubMenu ? '▲' : '▼'}</span>
            )}
          </button>
          {showStockSubMenu && (
            <ul className="ml-8 text-sm text-gray-700">
              <li>
                <Link
                  href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/admin/stock`}
                  className="flex items-center gap-3 my-2 p-2 rounded-lg hover:bg-gray-100"
                >
                  <span>📦</span>
                  {!collapsed && <span>Stock</span>}
                </Link>
              </li>
              <li>
                <Link
                  href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/admin/wholesale`}
                  className="flex items-center gap-3 my-2 p-2 rounded-lg hover:bg-gray-100"
                >
                  <span>🏬</span>
                  {!collapsed && <span>Wholesale</span>}
                </Link>
              </li>
              <li>
                <Link
                  href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/admin/stock11`}
                  className="flex items-center gap-3 my-2 p-2 rounded-lg hover:bg-gray-100"
                >
                  <span>📝</span>
                  {!collapsed && <span>บันทึกย้อนหลัง</span>}
                </Link>
              </li>
            </ul>
          )}
        </li>
        <li>
          <button
            className="flex items-center gap-3 w-full text-left my-3 p-3 rounded-lg hover:bg-gray-100"
            onClick={() => setShowAuditSubMenu(!showAuditSubMenu)}
          >
            <span>📁</span>
            {!collapsed && <span>Audit</span>}
            {!collapsed && (
              <span className="ml-auto">{showAuditSubMenu ? '▲' : '▼'}</span>
            )}
          </button>
          {showAuditSubMenu && (
            <ul className="ml-8 text-sm text-gray-700">
              <li>
                <Link
                  href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/admin/audit/system-check`}
                  className="flex items-center gap-3 my-2 p-2 rounded-lg hover:bg-gray-100"
                >
                  <span>📁</span>
                  {!collapsed && <span>System Check</span>}
                </Link>
              </li>
              <li>
                <Link
                  href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/admin/audit/logs`}
                  className="flex items-center gap-3 my-2 p-2 rounded-lg hover:bg-gray-100"
                >
                  <span>📜</span>
                  {!collapsed && <span>Logs</span>}
                </Link>
              </li>
              <li>
                <Link
                  href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/admin/audit/missing-log`}
                  className="flex items-center gap-3 my-2 p-2 rounded-lg hover:bg-gray-100"
                >
                  <span>❓</span>
                  {!collapsed && <span>Missing Log</span>}
                </Link>
              </li>
              <li>
                <button
                  onClick={() => {
                    const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
                    if (isLocalhost || confirm("⚠️ การใช้การ Monitor จะกินทรัพยากร Server เป็นจำนวนมาก\nแนะนำให้เปิดผ่าน LocalHost\n\nท่านยังต้องการเปิดอยู่หรือไม่?")) {
                      window.open(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/admin/audit/monitor`, "_blank");
                    }
                  }}
                  className="flex items-center gap-3 my-2 p-2 rounded-lg hover:bg-gray-100 w-full text-left"
                >
                  <span>🖥️</span>
                  {!collapsed && <span>Monitor</span>}
                </button>
              </li>
            </ul>
          )}
        </li>
      </ul>
    </nav>
  );
}

export default SideNav;
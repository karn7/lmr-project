'use client';

import { useState } from 'react';
import SideNav from './SideNav';
import { Bars3Icon } from '@heroicons/react/24/outline';
import { useSession, signOut } from 'next-auth/react';
import Image from 'next/image';
import Logo from '../../../../public/lmr.png';
import { useRouter } from 'next/navigation';

export default function AdminLayout({ children }) {
  const [showSideNav, setShowSideNav] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { data: session } = useSession();
  const router = useRouter();

  return (
    <div className="relative md:flex">
      {/* แถบบนมือถือ */}
      <div className="p-4 md:hidden flex justify-between items-center border-b">
        <Image
          src={Logo}
          alt="LMR Logo"
          className="h-8 w-auto cursor-pointer"
          onClick={() => router.push('/admin')}
        />
        <button onClick={() => setShowSideNav(!showSideNav)} className="text-gray-700">
          <Bars3Icon className="h-6 w-6" />
        </button>
      </div>

      {/* ปุ่ม Toggle collapse บนจอใหญ่ */}
      <div className="hidden md:flex flex-col items-center p-2 bg-gray-100">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-sm text-gray-500 hover:text-black"
        >
          {collapsed ? '➡️' : '⬅️'}
        </button>
      </div>

      {/* Overlay มือถือ */}
      {showSideNav && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setShowSideNav(false)}
        />
      )}

      {/* SideNav */}
      <div
        className={`z-50 bg-white shadow-md flex flex-col justify-between transition-all duration-300 ease-in-out
          md:static md:translate-x-0
          fixed inset-y-0 right-0 transform
          ${showSideNav ? 'translate-x-0' : 'translate-x-full'}
          ${collapsed ? 'md:w-20' : 'md:w-64'} w-64 md:block`}
      >
        {/* ด้านบน: ชื่อผู้ใช้ (เฉพาะมือถือ) */}
        <div className="p-4 border-b md:hidden">
          <div className="text-gray-700 font-semibold">👤 {session?.user?.name || 'ชื่อผู้ใช้'}</div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <SideNav collapsed={collapsed} />
        </div>

        {/* ด้านล่าง: Logout (เฉพาะมือถือ) */}
        <div className="p-4 border-t md:hidden">
          <button onClick={() => signOut()} className="text-red-600 w-full text-left">🚪 Logout</button>
        </div>
      </div>

      {/* Content */}
      <div className="w-full md:flex-1 p-4">{children}</div>
    </div>
  );
}

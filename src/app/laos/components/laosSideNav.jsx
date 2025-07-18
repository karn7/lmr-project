import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

function SideNav() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(null);
  const [shiftData, setShiftData] = useState(null);

  useEffect(() => {
    const checkOpenShift = async () => {
      try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/open-shift/check?employee=${session?.user?.name}`);
        const data = await res.json();
        console.log("Shift open status:", data.open); // Debug log
        setShiftData(data);
        setIsOpen(Boolean(data.open)); 
      } catch (error) {
        console.error("Failed to check shift status:", error);
        setIsOpen(false);
      }
    };
    checkOpenShift();
  }, []);

  return (
    <nav className='shadow-lg p-10 rounded-lg'>
      {isOpen === true && (
        <div className="mb-4 p-4 border border-gray-300 rounded bg-gray-50 text-sm">
          <h2 className="text-center font-semibold underline mb-2">ຂໍ້ມູນການເປີດຮ້ານ</h2>
          <div><strong>ວັນທີ:</strong> {new Date().toLocaleDateString()}</div>
          <div><strong>ຮອບທີ່:</strong> {`${shiftData?.shiftNo ?? "-"}`}</div>
        </div>
      )}
      <ul>
        {isOpen === false && (
          <li>
            <Link className='block my-3 p-3 rounded-lg bg-green-500 text-white text-center' href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/openshift`}>
              Open Store
            </Link>
          </li>
        )}
        <li>
          <Link
            className={`block my-3 p-3 rounded-lg ${isOpen ? '' : 'bg-gray-300 cursor-not-allowed pointer-events-none'}`}
            href={isOpen ? `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/laos/exchange` : "#"}
          >
            Exchange
          </Link>
        </li>
        <li>
          <Link className='block my-3 p-3 rounded-lg' href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/laos/rate`}>
            Rate
          </Link>
        </li>
        <li>
          <Link
            className={`block my-3 p-3 rounded-lg ${isOpen ? '' : 'bg-gray-300 cursor-not-allowed pointer-events-none'}`}
            href={isOpen ? `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/laos/cashdrawer` : "#"}
          >
            Cash Drawer
          </Link>
        </li>
        <li>
          <Link className='block my-3 p-3 rounded-lg' href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/`}>
            Report
          </Link>
        </li>
        {isOpen === true && (
          <li>
            <Link className='block my-3 p-3 rounded-lg bg-red-500 text-white text-center' href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/closeshift`}>
              Close Store
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}

export default SideNav;
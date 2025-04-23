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
    const res = await fetch(`/api/open-shift/check?employee=${session?.user?.name}`);
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
          <h2 className="text-center font-semibold underline mb-2">ข้อมูลการเปิดร้าน</h2>
          <div><strong>วันที่:</strong> {new Date().toLocaleDateString()}</div>
          <div><strong>รอบที่:</strong> {`${shiftData?.shiftNo ?? "-"}`}</div>
        </div>
      )}
      <ul>
        {isOpen === false && (
          <li>
            <Link className='block my-3 p-3 rounded-lg bg-green-500 text-white text-center' href="/openshift">
              Open Store
            </Link>
          </li>
        )}
        <li>
          <Link
            className={`block my-3 p-3 rounded-lg ${isOpen ? '' : 'bg-gray-300 cursor-not-allowed pointer-events-none'}`}
            href={isOpen ? "/welcome" : "#"}
          >
            Exchange
          </Link>
        </li>
        <li>
          <Link className='block my-3 p-3 rounded-lg' href="/Rate-Thai">
            Rate
          </Link>
        </li>
        <li>
          <Link
            className={`block my-3 p-3 rounded-lg ${isOpen ? '' : 'bg-gray-300 cursor-not-allowed pointer-events-none'}`}
            href={isOpen ? "/cashdrawer" : "#"}
          >
            Cash Drawer
          </Link>
        </li>
        <li>
          <a
            href="/rate-display"
            target="_blank"
            rel="noopener noreferrer"
            className="block my-3 p-3 rounded-lg"
          >
            Rate Display
          </a>
        </li>
        {isOpen === true && (
          <li>
            <Link className='block my-3 p-3 rounded-lg bg-red-500 text-white text-center' href="/closeshift">
              Close Store
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}

export default SideNav;
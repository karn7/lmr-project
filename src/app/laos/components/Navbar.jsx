"use client"

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Logo from '../../../../public/lmr.png'
import Image from 'next/image'
import { signOut } from 'next-auth/react'

function Navbar({ session }) {
  const [latestMessage, setLatestMessage] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatVisible, setChatVisible] = useState(false);
  const messageRef = useRef(null);

  const fetchChat = async () => {
    const today = new Date().toISOString().split("T")[0];
    const employee = session?.user?.name;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/shiftchat?employee=${encodeURIComponent(employee)}`, {
        cache: "no-store"
      });
      const data = await res.json();
      if (data?.chats?.length > 0 && data.chats[0]?.messages?.length > 0) {
        const sortedMessages = data.chats[0].messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 4);
        setChatMessages(sortedMessages);
        if (sortedMessages.length > 0) {
          if (sortedMessages[0].sender !== session?.user?.name) {
            setLatestMessage(sortedMessages[0].message);
          } else {
            setLatestMessage(null);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching shift chat:", err);
    }
  };

  useEffect(() => {
    if (session?.user?.branch && session?.user?.name) {
      fetchChat();
    }
  }, [session]);

  const handleSendMessage = async () => {
    const message = messageRef.current?.value.trim();
    if (!message) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/shiftchat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shiftId: session?.user?.name, // ใช้ชื่อพนักงานแทน shiftId
          employee: session?.user?.name,
          branch: session?.user?.branch,
          sender: session?.user?.name,
          date: new Date().toISOString().split("T")[0],
          createdBy: session?.user?.name,
          message,
          isFirstMessage: chatMessages.length === 0
        }),
      });

      if (res.ok) {
        alert("ส่งข้อความสำเร็จแล้ว");
        setChatVisible(false);
        setLatestMessage(null);
        fetchChat(); // ⬅️ เพิ่มบรรทัดนี้เพื่อดึงข้อมูลใหม่
      } else {
        const error = await res.json();
        alert("ส่งข้อความไม่สำเร็จ: " + error.error);
      }
    } catch (err) {
      console.error("Error sending chat message:", err);
      alert("เกิดข้อผิดพลาด");
    }
  };

  return (
    <>
    <nav className='shadow-xl'>
        <div className='container mx-auto'>
            <div className='flex justify-between items-center p-4'>
                <div>
                    <Link href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/`}>
                        <Image src={Logo} width={100} height={100} alt='LMR Logo' />
                    </Link>
                </div>
                <ul className='flex'>
                    {!session && (
                      <>
                        <li className='mx-3'><Link href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/login`}>Login</Link></li>
                        <li className='mx-3'><Link href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/register`}>Register</Link></li>
                      </>
                    )}
                    {session?.user && (
                      <li className="mx-3">
                        <div className="flex items-center space-x-4">
                          <div className={`relative flex items-center px-2 py-1 rounded ${latestMessage ? "border-2 border-red-500 animate-pulse" : ""}`}>
                            {latestMessage && (
                              <div className="inline-block mr-3 px-3 py-1 bg-yellow-100 text-yellow-800 rounded shadow text-sm max-w-xs truncate">
                                📩 {chatMessages[0]?.sender}: {latestMessage}
                              </div>
                            )}
                            <button
                              onClick={() => {
                                setIsChatOpen(!isChatOpen);
                                setChatVisible(true);
                                setLatestMessage(null);
                              }}
                              className={`text-xl ${latestMessage ? "text-red-600" : "text-gray-400"}`}
                            >
                              📨
                            </button>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-gray-800 text-lg font-medium">ສະບາຍດີ ທ່ານ{session.user.name}</span>
                            <span className="text-gray-500 text-sm">ສາຂາ: {session.user.branch}</span>
                          </div>
                          <div className="h-10 border-l border-gray-400" />
                          <button onClick={() => signOut()} className="bg-red-500 text-white py-2 px-3 rounded-md text-lg hover:bg-red-600">ອອກຈາກລະບົບ</button>
                        </div>
                      </li>
                    )}
                </ul>
            </div>
        </div>
    </nav>
    {chatVisible && (
      <div className="fixed top-24 right-5 bg-white border border-gray-300 shadow-lg p-4 rounded w-96 z-50">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-bold text-gray-800">📩 ຕອບກັບຂໍ້ຄວາມ</h2>
          <button
            onClick={() => setChatVisible(false)}
            className="text-gray-500 hover:text-gray-800 text-sm"
          >
            ✕ ປິດ
          </button>
        </div>
        {chatMessages.length > 0 ? (
          <>
            <div className="max-h-48 overflow-y-auto mb-3">
              {chatMessages.map((msg, index) => (
                <div key={index} className="bg-gray-100 text-gray-700 text-sm p-2 rounded mb-1">
                  <div className="font-semibold">{msg.sender}</div>
                  <div>{msg.message}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(msg.timestamp).toLocaleString("th-TH", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                      day: "2-digit",
                      month: "2-digit"
                    })}
                  </div>
                </div>
              ))}
            </div>
            <textarea
              ref={messageRef}
              rows="3"
              className="w-full border p-2 rounded mb-3 text-sm"
              placeholder="ພິມຂໍ້ຄວາມຂອງທ່ານທີ່ນີ້..."
            />
            <button
              onClick={handleSendMessage}
              className="w-full bg-blue-600 text-white py-1 rounded hover:bg-blue-700 text-sm"
            >
              ສົ່ງຂໍ້ຄວາມ
            </button>
          </>
        ) : (
          <>
            <div className="text-gray-500 text-sm text-center mb-3">ບໍ່ມີການສົນທະນາ</div>
            <textarea
              ref={messageRef}
              rows="3"
              className="w-full border p-2 rounded mb-3 text-sm"
              placeholder="ເລີ່ມການສົນທະນາຂອງທ່ານທີ່ນີ້..."
            />
            <button
              onClick={handleSendMessage}
              className="w-full bg-green-600 text-white py-1 rounded hover:bg-green-700 text-sm"
            >
              ເລີ່ມການສົນທະນາ
            </button>
          </>
        )}
      </div>
    )}
    </>
  )
}

export default Navbar
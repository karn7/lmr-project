"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export default function ChatPage() {
  const [chatData, setChatData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [replyMessages, setReplyMessages] = useState({});
  const { data: session } = useSession();

  // สำหรับ mock shiftId แนะนำให้เปลี่ยนจากค่าคงที่เป็น dynamic ตาม context จริง
  const shiftId = null;

  const fetchChat = async () => {
    try {
      const res = await fetch(`/api/shiftchat`);
      const data = await res.json();

      if (data.success) {
        if (Array.isArray(data.chats)) {
          setChatData(data.chats.filter(Boolean));
        } else if (data.chat && typeof data.chat === "object") {
          setChatData([data.chat]);
        } else {
          setChatData([]);
        }
      } else {
        setError(data.error || "ไม่พบข้อมูลแชท");
      }
    } catch (err) {
      console.error("Error fetching chat:", err);
      setError("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChat();
  }, []);

  const handleDeleteChat = async (employee) => {
    if (!confirm("คุณต้องการลบแชทนี้ใช่หรือไม่?")) return;

    try {
      const res = await fetch("/api/shiftchat", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee }),
      });

      if (res.ok) {
        setChatData((prev) => prev.filter((chat) => chat.employee !== employee));
      } else {
        const error = await res.json();
        alert("ไม่สามารถลบแชทได้: " + error.error);
      }
    } catch (err) {
      console.error("Error deleting chat:", err);
      alert("เกิดข้อผิดพลาดขณะลบแชท");
    }
  };

  const handleSendMessage = async (chat) => {
    const message = replyMessages[chat.employee]?.trim();
    if (!message) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/shiftchat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shiftId: chat.shiftId || chat.employee,
          employee: chat.employee,
          branch: chat.branch,
          sender: session?.user?.name,
          date: new Date().toISOString().split("T")[0],
          createdBy: session?.user?.name,
          message
        }),
      });

      if (res.ok) {
        alert("ส่งข้อความสำเร็จแล้ว");
        setReplyMessages((prev) => ({ ...prev, [chat.employee]: "" }));
        fetchChat(); // โหลดข้อมูลแชทใหม่
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
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold mb-4">กล่องสนทนา</h1>

      {loading ? (
        <p>กำลังโหลด...</p>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : chatData && chatData.length > 0 ? (
        <div className="space-y-4">
          {chatData.map((chat, chatIdx) => (
            <div key={chatIdx} className="mb-6 border border-gray-300 rounded-lg p-4 shadow-sm">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-900">{chat.employee}</h2>
                <button
                  className="text-red-500 text-sm hover:underline"
                  onClick={() => handleDeleteChat(chat.employee)}
                >
                  ลบ
                </button>
              </div>
              <div className="text-sm text-gray-500 mb-4">
                เวลาเริ่มต้น:{" "}
                {new Date(chat.createdAt).toLocaleString("th-TH", {
                  dateStyle: "short",
                  timeStyle: "short",
                  hour12: false
                })}
              </div>
              {chat.messages.slice().reverse().map((msg, idx) => (
                <div key={idx} className="bg-gray-100 p-3 rounded shadow mb-2 text-sm text-gray-800">
                  <div>
                    {new Date(msg.timestamp).toLocaleTimeString("th-TH", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false
                    })}{" "}
                    - <span className="font-semibold">{msg.sender}</span>: {msg.message}
                  </div>
                </div>
              ))}
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  className="border border-gray-300 rounded px-2 py-1 text-sm flex-1"
                  placeholder="พิมพ์ข้อความตอบกลับ..."
                  value={replyMessages[chat.employee] || ""}
                  onChange={(e) =>
                    setReplyMessages(prev => ({ ...prev, [chat.employee]: e.target.value }))
                  }
                />
                <button
                  className="bg-blue-500 text-white px-3 py-1 rounded text-sm"
                  onClick={() => handleSendMessage(chat)}
                >
                  ส่ง
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p>ไม่มีข้อความในแชทนี้</p>
      )}
    </div>
  );
}
"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/login`);
      return;
    }

    if (status !== "authenticated") return;

    // Admin can proceed as usual
    if (session?.user?.role === "admin") {
      router.push(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/admin`);
      return;
    }

    // Non-admin: do not redirect anywhere. Show message + auto logout after 10 seconds.
    setSecondsLeft(10);

    const interval = setInterval(() => {
      setSecondsLeft((prev) => (typeof prev === "number" ? Math.max(prev - 1, 0) : prev));
    }, 1000);

    const timeout = setTimeout(() => {
      // Redirect to login after sign out
      signOut({ callbackUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/login` });
    }, 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [status, session, router]);

  if (status === "authenticated" && session?.user) {
    return (
      <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <p>👋 เข้าสู่ระบบในชื่อ: <strong>{session.user.name || session.user.email}</strong></p>
        <p>🛡️ บทบาท: <strong>{session.user.role}</strong></p>
        <p>🌍 ประเทศ: <strong>{session.user.country}</strong></p>
        {session?.user?.role !== "admin" ? (
          <>
            {session?.user?.country === "Thai" ? (
              <p style={{ color: "#b00020" }}>
                ❌ ไม่สามารถใช้งานได้ กรุณาเข้าโปรแกรมที่ไอคอนบนเดสก์ท็อป
              </p>
            ) : session?.user?.country === "Laos" ? (
              <p style={{ color: "#b00020" }}>
                ❌ ບໍ່ສາມາດໃຊ້ງານໄດ້ ກະລຸນາເຂົ້າໂປຣແກຣມຈາກໄອຄອນເທິງໜ້າເດສກທັອບ
              </p>
            ) : (
              <p style={{ color: "#b00020" }}>
                ❌ ไม่สามารถใช้งานได้ กรุณาเข้าโปรแกรมจากไอคอนบนเดสก์ท็อป
              </p>
            )}
            <p>⏳ ระบบจะออกจากระบบอัตโนมัติใน {typeof secondsLeft === "number" ? secondsLeft : 10} วินาที</p>
          </>
        ) : (
          <p>➡️ กำลังไปยังหน้าหลัก...</p>
        )}
      </div>
    );
  }
  return null;
}
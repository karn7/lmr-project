"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/login`);
    } else if (status === "authenticated") {
      if (session?.user?.role === "admin") {
        router.push(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/admin`);
      } else {
        if (session?.user?.country === "Thai") {
          router.push(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/mainthai`);
        } else if (session?.user?.country === "Laos") {
          router.push(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/laos/mainlaos`);
        }
      }
    }
  }, [status, session, router]);

  if (status === "authenticated" && session?.user) {
    return (
      <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <p>👋 เข้าสู่ระบบในชื่อ: <strong>{session.user.name || session.user.email}</strong></p>
        <p>🛡️ บทบาท: <strong>{session.user.role}</strong></p>
        <p>🌍 ประเทศ: <strong>{session.user.country}</strong></p>
        <p>➡️ กำลังไปยังหน้าหลัก...</p>
      </div>
    );
  }
  return null;
}
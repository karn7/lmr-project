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
        } else if (session?.user?.country === "laos") {
          router.push(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/mainlaos`);
        }
      }
    }
  }, [status, session, router]);

  return null; 
}
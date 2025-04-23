"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      if (session?.user?.role === "admin") {
        router.push("/admin");
      } else {
        if (session?.user?.country === "Thai") {
          router.push("/mainthai");
        } else if (session?.user?.country === "laos") {
          router.push("/mainlaos");
        }
      }
    }
  }, [status, session, router]);

  return null; 
}


"use client";

import React from "react";
import AdminNav from "../../../components/AdminNav";
import AdminLayout from "../../../components/AdminLayout";
import Container from "../../../components/Container";
import Footer from "../../../components/Footer";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";

function LogsPage() {
  const { data: session } = useSession();

  React.useEffect(() => {
    if (!session) {
      redirect(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/login`);
    } else if (session?.user?.role !== "admin") {
      redirect(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/welcome`);
    }
  }, [session]);

  return (
    <Container>
      <div className="hidden md:block">
        <AdminNav session={session} />
      </div>
      <div className="flex-grow">
        <AdminLayout>
          <div className="p-4 bg-white rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Audit Logs</h2>
            <p className="text-gray-600">กำลังพัฒนา...</p>
          </div>
        </AdminLayout>
      </div>
      <Footer />
    </Container>
  );
}

export default LogsPage;
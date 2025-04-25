import { Suspense } from "react";
import PrintReceiptPage from "./PrintReceiptPage";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-10 text-center">กำลังโหลด...</div>}>
      <PrintReceiptPage />
    </Suspense>
  );
}
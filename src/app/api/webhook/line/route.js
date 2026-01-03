

import { NextResponse } from "next/server";

/**
 * LINE Messaging API webhook endpoint
 * - Use this ONLY to capture groupId once (or for future automation)
 * - LINE will send POST events here
 * - We always return 200 OK so "Verify" passes
 */
export async function POST(req) {
  try {
    const body = await req.json();

    const events = Array.isArray(body?.events) ? body.events : [];

    // Log a compact summary (easy to copy groupId)
    for (const ev of events) {
      const src = ev?.source || {};
      const groupId = src?.groupId;
      const roomId = src?.roomId;
      const userId = src?.userId;

      if (groupId) console.log("[LINE webhook] groupId:", groupId);
      if (roomId) console.log("[LINE webhook] roomId:", roomId);
      if (userId) console.log("[LINE webhook] userId:", userId);

      console.log(
        "[LINE webhook] event:",
        JSON.stringify(
          {
            type: ev?.type,
            timestamp: ev?.timestamp,
            sourceType: src?.type,
            messageType: ev?.message?.type,
            text: ev?.message?.text,
          },
          null,
          2
        )
      );
    }

    // Optional: full raw payload (uncomment if needed)
    // console.log("[LINE webhook] raw payload:", JSON.stringify(body, null, 2));

    // Always return 200 OK to LINE
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Still return 200 to avoid LINE retries while you debug
    console.error("[LINE webhook] error:", err);
    return NextResponse.json({ ok: true, error: "logged" });
  }
}

// Health check / simple open test
export async function GET() {
  return NextResponse.json({ ok: true, message: "LINE webhook is running" });
}
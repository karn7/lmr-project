import { NextResponse } from "next/server";
import crypto from "crypto";
import { connectMongoDB } from "../../../../../lib/mongodb";
import Post from "../../../../../models/post";

/**
 * LINE Bot webhook (production)
 * - Verify X-Line-Signature (HMAC-SHA256)
 * - Auto-reply ONLY for rate questions
 *   - Pull latest rate from MongoDB `posts` (Post model)
 *     title = currency (USD/CNY/THB...)
 *     content = bank note text (e.g. 100-50)
 *     buy/sell (+ buylaos/selllaos optional)
 * - Other questions: quick ack (optionally you can extend to save inbox later)
 *
 * ENV required:
 * - LINE_CHANNEL_ACCESS_TOKEN
 * - LINE_CHANNEL_SECRET
 */

function verifyLineSignature(rawBody, signature, channelSecret) {
  if (!signature || !channelSecret) return false;
  const hmac = crypto.createHmac("sha256", channelSecret);
  hmac.update(rawBody, "utf8");
  const digest = hmac.digest("base64");

  const a = Buffer.from(digest);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function normalizeText(t = "") {
  return String(t).trim().toLowerCase();
}

function detectCurrency(text) {
  // Keywords that often indicate "asking rate"
  const looksLikeRateQuestion = /(เรท|rate|อัตรา|แลก|exchange|ซื้อ|ขาย|เท่าไหร่|วันนี้)/i.test(
    text
  );

  // Currency mapping (extend freely)
  const map = [
    { code: "USD", re: /(\busd\b|ดอลลาร์|dollar|us\s*d)/i },
    { code: "CNY", re: /(\bcny\b|หยวน|yuan|rmb)/i },
    { code: "THB", re: /(\bthb\b|บาท|baht)/i },
    { code: "LAK", re: /(\blak\b|ກີບ|กีบ|kip)/i },
    { code: "EUR", re: /(\beur\b|ยูโร|euro)/i },
    { code: "JPY", re: /(\bjpy\b|เยน|yen)/i },
    { code: "KRW", re: /(\bkrw\b|วอน|won)/i },
    { code: "GBP", re: /(\bgbp\b|ปอนด์|pound)/i },
  ];

  const found = map.find((x) => x.re.test(text));
  return {
    isRate: Boolean(looksLikeRateQuestion && found?.code),
    code: found?.code || null,
  };
}

function formatRateFromPost(postDoc, code) {
  const bank = postDoc?.content ?? null;
  const updatedAt = postDoc?.updatedAt || postDoc?.createdAt || null;

  const parts = [];
  parts.push(`เรทวันนี้ (${code})`);

  if (bank) parts.push(`แบงค์: ${bank}`);

  if (code === "LAK") {
    // LAK ใช้เรทฝั่งลาว
    if (postDoc?.buylaos != null) parts.push(`รับซื้อ: ${postDoc.buylaos}`);
    if (postDoc?.selllaos != null) parts.push(`ขายออก: ${postDoc.selllaos}`);
  } else {
    // สกุลอื่นใช้เรทฝั่งไทย
    if (postDoc?.buy != null) parts.push(`รับซื้อ: ${postDoc.buy}`);
    if (postDoc?.sell != null) parts.push(`ขายออก: ${postDoc.sell}`);
  }

  if (updatedAt) {
    const d = new Date(updatedAt);
    if (!Number.isNaN(d.getTime())) {
      const dt = d.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
      parts.push(`อัปเดต: ${dt}`);
    }
  }

  parts.push("ต้องการแลกจำนวนเท่าไหร่ พิมพ์มาได้เลยครับ");
  return parts.join("\n");
}

async function lineReply(replyToken, text) {
  const accessToken =
    process.env.LINE_CHANNEL_ACCESS_TOKEN_RATE ||
    process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!accessToken) {
    console.error("[LINE bot] Missing LINE_CHANNEL_ACCESS_TOKEN_RATE or LINE_CHANNEL_ACCESS_TOKEN");
    return;
  }

  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("[LINE bot] reply failed:", res.status, errText);
  }
}

async function findLatestRatePost(code) {
  await connectMongoDB();

  // title = currency code (USD/CNY/...) in your design
  // Sort by updatedAt first, then createdAt for safety
  const post = await Post.findOne({ title: code })
    .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
    .lean();

  return post;
}

export async function POST(req) {
  // LINE signature verification requires RAW body
  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature");
  const channelSecret =
    process.env.LINE_CHANNEL_SECRET_RATE || process.env.LINE_CHANNEL_SECRET;

  const isValid = verifyLineSignature(rawBody, signature, channelSecret);
  if (!isValid) {
    console.warn("[LINE bot] Invalid signature");
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch (e) {
    console.error("[LINE bot] JSON parse error:", e);
    return NextResponse.json({ ok: true });
  }

  const events = Array.isArray(body?.events) ? body.events : [];

  for (const ev of events) {
    try {
      const src = ev?.source || {};
      const groupId = src?.groupId;
      const roomId = src?.roomId;
      const userId = src?.userId;

      // Compact logs (still useful)
      if (groupId) console.log("[LINE bot] groupId:", groupId);
      if (roomId) console.log("[LINE bot] roomId:", roomId);
      if (userId) console.log("[LINE bot] userId:", userId);

      // Only handle text message events
      if (ev?.type !== "message") continue;
      if (ev?.message?.type !== "text") continue;

      const text = ev?.message?.text || "";
      const replyToken = ev?.replyToken;
      if (!replyToken) continue;

      const { isRate, code } = detectCurrency(text);

      if (isRate && code) {
        const post = await findLatestRatePost(code);

        if (!post) {
          await lineReply(
            replyToken,
            `ขออภัยครับ ตอนนี้ยังไม่พบเรทของ ${code} ในระบบ\nพิมพ์ถามใหม่อีกครั้ง หรือรอเจ้าหน้าที่ตอบกลับได้เลยครับ`
          );
        } else {
          const msg = formatRateFromPost(post, code);
          await lineReply(replyToken, msg);
        }

        continue;
      }

      // Not a rate question
      await lineReply(
        replyToken,
        "รับทราบครับ 🙏 ถ้าเป็นคำถามเรท พิมพ์เช่น: เรท USD หรือ เรท หยวน\nเดี๋ยวเจ้าหน้าที่ตอบกลับให้โดยเร็ว"
      );
    } catch (err) {
      console.error("[LINE bot] event handler error:", err);
      // keep going for other events
    }
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "LINE bot is running" });
}
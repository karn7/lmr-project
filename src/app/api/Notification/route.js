import { NextResponse } from "next/server";
import mongoose from "mongoose";
import Notification from "../../../../models/notifications";
import { connectMongoDB } from "../../../../lib/mongodb";

export async function POST(req) {
  try {
    await connectMongoDB();
    const body = await req.json();
    const { docNumber, message, employee, type, details } = body;

    const notification = await Notification.create({
      docNumber,
      message,
      employee,
      type,
      details: details || {},
    });

    return NextResponse.json({ success: true, notification });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    await connectMongoDB();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const filter = status ? { status } : {};
    const notifications = await Notification.find(filter).sort({ createdAt: -1 });

    return NextResponse.json({ success: true, notifications });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    await connectMongoDB();
    const body = await req.json();
    const { id, action } = body;

    const update = {};
    if (action === "read") {
      update.status = "read";
    } else if (action === "resolve") {
      update.status = "resolved";
      update.resolvedAt = new Date();
    }

    const updated = await Notification.findByIdAndUpdate(id, update, { new: true });

    return NextResponse.json({ success: true, notification: updated });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
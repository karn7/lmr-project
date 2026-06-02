import { NextResponse } from "next/server";
import Shift from "../../../../models/shift";
import { connectMongoDB } from "../../../../lib/mongodb";

function getPreviousDate(dateString) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export async function GET(req) {
  try {
    await connectMongoDB();

    const { searchParams } = new URL(req.url);
    const employee = searchParams.get("employee")?.trim();
    const branch = searchParams.get("branch")?.trim();
    const date = searchParams.get("date") || new Date().toISOString().slice(0, 10);
    const previousDate = getPreviousDate(date);

    const query = {
      date: previousDate,
      closedAt: { $ne: null },
      isDeleted: { $ne: true },
    };

    if (branch) {
      query.branch = branch;
    }

    if (employee) {
      query.employee = employee;
    }

    const previousShift = await Shift.findOne(query)
      .sort({ shiftNo: -1, closedAt: -1 })
      .lean();

    if (!previousShift) {
      return NextResponse.json({
        found: false,
        message: "No previous closed shift found",
        date,
        previousDate,
        employee,
        branch,
      });
    }

    return NextResponse.json({
      found: true,
      date: previousShift.date,
      previousDate,
      shiftNo: previousShift.shiftNo,
      employee: previousShift.employee,
      branch: previousShift.branch,
      closeAmount: previousShift.closeAmount || {},
      closedAt: previousShift.closedAt,
    });
  } catch (error) {
    console.error("Error fetching previous close shift:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await connectMongoDB();

    const { shiftNo, closeAmount, employee, branch } = await req.json();
    const date = new Date().toISOString().slice(0, 10);

    const query = {
      date,
      shiftNo,
      employee: employee?.trim(),
      closedAt: null,
      isDeleted: { $ne: true },
    };

    if (branch?.trim()) {
      query.branch = branch.trim();
    }

    const shift = await Shift.findOne(query);

    if (!shift) {
      return NextResponse.json({ message: "No open shift found" }, { status: 404 });
    }

    // อัปเดตยอดเงินปิดร้านและเวลาดำเนินการ
    shift.closeAmount = closeAmount;
    shift.closedAt = new Date();
    await shift.save().catch((err) => console.error("❌ save error:", err));

    return NextResponse.json({ message: "Shift closed successfully" });
  } catch (error) {
    console.error("Error closing shift:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

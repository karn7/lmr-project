import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { connectMongoDB } from '../../../../../lib/mongodb';
import Attendance from '../../../../../models/attendance';
import { employeeLabel, monthRange } from '../../../../../lib/attendance.mjs';

export const dynamic = 'force-dynamic';
const fail = (message, status) => NextResponse.json({ message }, { status });
const fields = '_id date employee employeeCode branch country fullnameTh firstnameTh lastnameTh checkInAt checkOutAt';

export async function GET(req) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return fail('กรุณาเข้าสู่ระบบ', 401);
    if (token.role !== 'admin') return fail('เฉพาะผู้ดูแลระบบเท่านั้น', 403);
    const params = new URL(req.url).searchParams;
    if (params.get('options') === '1') {
      await connectMongoDB();
      // Keep historical employees selectable even when they have no records this month.
      const employees = await Attendance.aggregate([
        { $sort: { checkInAt: -1, _id: -1 } },
        { $group: {
          _id: '$employee',
          employee: { $first: '$employee' }, employeeCode: { $first: '$employeeCode' },
          fullnameTh: { $first: '$fullnameTh' }, firstnameTh: { $first: '$firstnameTh' }, lastnameTh: { $first: '$lastnameTh' },
        } },
      ]);
      return NextResponse.json({ employees: employees.filter((item) => item.employee).map((item) => ({
        value: item.employee, label: employeeLabel(item),
      })).sort((a, b) => a.label.localeCompare(b.label, 'th')) }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const month = params.get('month');
    const range = monthRange(month);
    if (!range) return fail('กรุณาเลือกเดือนในรูปแบบ YYYY-MM', 400);
    const filter = { date: { $gte: range.start, $lt: range.end } };
    const employee = params.get('employee');
    if (employee) filter.employee = employee;
    await connectMongoDB();
    const records = await Attendance.find(filter).select(fields).sort({ date: 1, checkInAt: 1, _id: 1 }).lean();
    return NextResponse.json({ month, records }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Attendance lookup failed:', error);
    return fail('ไม่สามารถโหลดข้อมูลลงเวลาได้ กรุณาลองอีกครั้ง', 500);
  }
}

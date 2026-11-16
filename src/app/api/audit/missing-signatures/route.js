import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import mongoose from 'mongoose';
import { connectMongoDB } from '../../../../../lib/mongodb';
import Record from '../../../../../models/record';
import User from '../../../../../models/user';
import { missingSignature, signatureDay, signatureImageType, MAX_SIGNATURE_BYTES } from '../../../../../lib/customer-signatures.mjs';

export const dynamic = 'force-dynamic';
const fields = 'docNumber customerId customerName branch payType date createdAt total employee';
const fail = (message, status) => NextResponse.json({ message }, { status });
async function authorize(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  return { token, error: !token ? fail('Unauthorized', 401) : token.role !== 'admin' ? fail('Forbidden', 403) : null };
}

export async function GET(req) {
  try {
    const { error } = await authorize(req);
    if (error) return error;
    const qs = new URL(req.url).searchParams;
    await connectMongoDB();
    if (qs.get('options') === '1') {
      const [userBranches, recordBranches, payTypes] = await Promise.all([
        User.distinct('branch'), Record.distinct('branch'), Record.distinct('payType'),
      ]);
      return NextResponse.json({ branches: [...new Set([...userBranches, ...recordBranches])].filter(Boolean).sort(), payTypes: [...new Set(['Buying', 'Selling', ...payTypes])].filter(Boolean).sort() });
    }
    const page = Math.max(1, Number.parseInt(qs.get('page'), 10) || 1);
    const limit = 20;
    let filter;
    if (qs.has('recordId')) {
      const recordId = qs.get('recordId');
      if (!mongoose.isValidObjectId(recordId)) return fail('รหัสรายการไม่ถูกต้อง', 400);
      const target = await Record.findById(recordId).select('customerId').lean();
      if (!target) return fail('ไม่พบรายการ', 404);
      if (!target.customerId?.trim()) return NextResponse.json({ records: [], total: 0, page, pages: 0 });
      filter = { customerId: target.customerId, _id: { $ne: target._id }, $nor: [missingSignature] };
    } else {
      const day = signatureDay(qs.get('date'));
      if (!day) return fail('กรุณาเลือกวันที่ที่ถูกต้องทีละวัน', 400);
      filter = { $and: [day, missingSignature] };
      if (qs.get('branch')) filter.branch = qs.get('branch');
      if (qs.get('payType')) filter.payType = qs.get('payType');
    }
    const [records, total] = await Promise.all([
      Record.find(filter).select(fields).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Record.countDocuments(filter),
    ]);
    return NextResponse.json({ records, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('Signature audit lookup failed:', error);
    return fail('ไม่สามารถตรวจสอบลายเซ็นได้ กรุณาลองอีกครั้ง', 500);
  }
}

export async function POST(req) {
  try {
    const { token, error } = await authorize(req);
    if (error) return error;
    if (Number(req.headers.get('content-length')) > MAX_SIGNATURE_BYTES + 65536) return fail('ไฟล์ต้องมีขนาดไม่เกิน 2 MB', 413);
    const form = await req.formData();
    const recordId = form.get('recordId');
    const sourceRecordId = form.get('sourceRecordId');
    const file = form.get('file');
    const uploadSource = form.get('source') === 'draw' ? 'draw' : 'upload';
    if (!mongoose.isValidObjectId(recordId)) return fail('รหัสรายการไม่ถูกต้อง', 400);
    if ((!sourceRecordId && !file) || (sourceRecordId && file)) return fail('เลือกไฟล์หรือลายเซ็นเดิมอย่างใดอย่างหนึ่ง', 400);
    await connectMongoDB();
    const target = await Record.findById(recordId).select('customerId').lean();
    if (!target) return fail('ไม่พบรายการ', 404);
    let image, contentType;
    if (sourceRecordId) {
      if (!mongoose.isValidObjectId(sourceRecordId) || sourceRecordId === recordId) return fail('รายการต้นทางไม่ถูกต้อง', 400);
      const source = await Record.findById(sourceRecordId).select('customerId customerSignature');
      if (!target.customerId?.trim() || !source || source.customerId !== target.customerId) return fail('ต้องใช้ลายเซ็นของลูกค้ารหัสเอกสารเดียวกันเท่านั้น', 400);
      if (!source.customerSignature?.image?.length) return fail('ไม่พบลายเซ็นต้นทาง กรุณาเลือกใหม่', 409);
      image = Buffer.from(source.customerSignature.image);
      contentType = signatureImageType(image);
    } else {
      if (typeof file?.arrayBuffer !== 'function' || !file.size || file.size > MAX_SIGNATURE_BYTES) return fail('ไฟล์ต้องมีขนาด 1 byte ถึง 2 MB', 400);
      image = Buffer.from(await file.arrayBuffer());
      contentType = signatureImageType(image);
    }
    if (!contentType) return fail('รองรับเฉพาะไฟล์ภาพ PNG, JPEG และ WebP ขนาดไม่เกิน 2 MB', 400);
    // Atomically avoid replacing a signature added by another operator.
    const updated = await Record.findOneAndUpdate({ _id: recordId, customerId: target.customerId ?? null, ...missingSignature }, { $set: {
      customerSignature: { image, contentType, addedAt: new Date(), addedBy: String(token.email || token.name || token.sub || ''), source: sourceRecordId ? 'saved' : uploadSource, sourceRecordId: sourceRecordId || undefined },
      signatureConfirmed: true,
    } }, { new: true }).select('_id').lean();
    if (!updated) return fail('รายการนี้มีลายเซ็นแล้วหรือข้อมูลเปลี่ยนแปลง กรุณาตรวจสอบใหม่', 409);
    return NextResponse.json({ success: true, message: 'บันทึกลายเซ็นลูกค้าเรียบร้อยแล้ว' });
  } catch (error) {
    console.error('Signature audit save failed:', error);
    return fail('บันทึกลายเซ็นไม่สำเร็จ กรุณาลองอีกครั้ง', 500);
  }
}

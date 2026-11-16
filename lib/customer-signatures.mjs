export const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024;

// Flags alone do not establish whether an actual signature image is stored.
export const missingSignature = {
  $expr: { $eq: [{ $cond: [
    { $eq: [{ $type: '$customerSignature.image' }, 'binData'] },
    { $binarySize: '$customerSignature.image' }, 0,
  ] }, 0] },
};

export function signatureDay(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return null;
  const utc = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(utc.getTime()) || utc.toISOString().slice(0, 10) !== date) return null;
  const start = new Date(`${date}T00:00:00+07:00`);
  return { $or: [{ date }, { date: { $in: [null, ''] }, createdAt: { $gte: start, $lt: new Date(start.getTime() + 86400000) } }] };
}

export function signatureImageType(bytes) {
  if (!bytes?.length || bytes.length > MAX_SIGNATURE_BYTES) return null;
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { attendanceImage } from '../lib/attendance-image.mjs';

test('PNG includes the whole month, employee name, warnings and all entries without clipping', async () => {
  const drawn = [];
  const ctx = {
    measureText: (text) => ({ width: Array.from(text).length * 10 }),
    fillRect() {}, strokeRect() {},
    fillText(text, x, y) { drawn.push({ text, x, y }); },
  };
  const canvas = { getContext: () => ctx, toBlob: (callback, type) => callback(new Blob(['image'], { type })) };
  const previousDocument = globalThis.document;
  globalThis.document = { fonts: { ready: Promise.resolve() }, createElement: () => canvas };
  try {
    const records = Array.from({ length: 6 }, (_, index) => ({
      date: '2026-08-31', employee: `พนักงาน ${index}`, fullnameTh: `ชื่อพนักงานยาวสำหรับทดสอบการตัดบรรทัด ${index}`,
      checkInAt: '2026-08-31T04:00:00Z', checkOutAt: '2026-08-31T11:00:00Z',
    }));
    const result = await attendanceImage({ month: '2026-08', monthTitle: 'สิงหาคม 2569', employeeTitle: 'พนักงานทั้งหมด', records });
    assert.equal(result.type, 'image/png');
    assert.equal(canvas.width, 1960);
    assert.ok(drawn.some(({ text }) => text.includes('สิงหาคม 2569')));
    assert.ok(drawn.some(({ text }) => text.includes('พนักงานทั้งหมด')));
    assert.deepEqual(drawn.filter(({ text }) => /^\d+$/.test(text)).map(({ text }) => Number(text)), Array.from({ length: 31 }, (_, i) => i + 1));
    assert.equal(drawn.filter(({ text }) => text === 'มาสาย (หลัง 10:00 น.)').length, 6);
    assert.equal(drawn.filter(({ text }) => text.includes('ออกก่อนเวลา')).length, 6);
    assert.ok(drawn.every(({ y }) => y + 26 <= canvas.height));
    assert.ok(canvas.height > 6 * 180);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

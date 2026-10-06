import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SourceTextModule, SyntheticModule } from 'node:vm';

const id = '0123456789abcdef01234567';
const itemId = '0123456789abcdef01234568';
async function fixture(role = 'admin', fail = false) {
  let stored = { _id: id, docNumber: 'B001', items: [{ _id: itemId, amount: 100, rate: 35, total: 3500 }, { _id: 'other', amount: 10, rate: 2, total: 20 }], total: 3520 };
  const mocks = {
    'next/server': { NextResponse: { json: (data, options = {}) => ({ data, status: options.status || 200 }) } },
    'next-auth/jwt': { getToken: async () => role ? { role } : null },
    mongoose: { default: { isValidObjectId: v => /^[a-f0-9]{24}$/.test(v || '') } },
    '../../../../../models/record': { default: { find: () => ({ session: async () => {
      const record = structuredClone(stored);
      record.items.id = value => record.items.find(i => i._id === value);
      record.save = async ({ session }) => { assert.ok(session); if (fail) throw new Error('DB failure'); stored = { ...record, items: Array.from(record.items) }; };
      return [record];
    } }) } },
    '../../../../../lib/record-numbering': { withRecordNumbering: async work => {
      const before = structuredClone(stored);
      try { return await work({ transaction: true }); } catch (error) { stored = before; throw error; }
    } },
  };
  const module = new SourceTextModule(await readFile(new URL('../src/app/api/record/rates/route.js', import.meta.url), 'utf8'));
  await module.link(async name => { const exports = mocks[name]; return new SyntheticModule(Object.keys(exports), function () { for (const [key, value] of Object.entries(exports)) this.setExport(key, value); }); });
  await module.evaluate();
  const change = { recordId: id, itemId, expectedDocNumber: 'B001', expectedRate: 35, expectedAmount: 100, expectedTotal: 3500, rate: 36 };
  return { call: (changes = [change]) => module.namespace.POST({ json: async () => ({ branch: 'Asawann', changes }) }), change, stored: () => stored };
}
test('updates rate and bill total while preserving other items', async () => {
  const f = await fixture(); assert.equal((await f.call()).status, 200);
  assert.equal(f.stored().total, 3620); assert.equal(f.stored().items[1].total, 20);
});
test('rejects non-admin and invalid rates', async () => {
  assert.equal((await (await fixture('user')).call()).status, 403);
  const f = await fixture(); assert.equal((await f.call([{ ...f.change, rate: 0 }])).status, 400);
  assert.equal(f.stored().total, 3520);
});
test('rejects entire batch on stale rows or database failure', async () => {
  const f = await fixture(); assert.equal((await f.call([{ ...f.change, expectedAmount: 99 }])).status, 409);
  assert.equal(f.stored().total, 3520);
  const failure = await fixture('admin', true); assert.equal((await failure.call()).status, 500);
  assert.equal(failure.stored().total, 3520);
});

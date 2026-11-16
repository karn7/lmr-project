import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SourceTextModule, SyntheticModule } from 'node:vm';

async function fixture(role = 'admin') {
  let rows = [
    { branch: 'Asawann', date: '2026-10-01' },
    { branch: 'Asawann', date: '2026-10-02' },
    { branch: 'Asawann', date: '2026-10-03' },
    { branch: 'Asawann', date: '2026-10-04' },
    { branch: 'Other', date: '2026-10-02' },
  ];
  let connects = 0;
  const mocks = {
    'next/server': { NextResponse: { json: (data, options = {}) => ({ data, status: options.status || 200 }) } },
    'next-auth/jwt': { getToken: async () => role ? { role } : null },
    '../../../../../lib/mongodb': { connectMongoDB: async () => { connects++; } },
    '../../../../../models/dailyStocks': { default: { deleteMany: async filter => {
      const before = rows.length;
      rows = rows.filter(row => !(row.branch === filter.branch && row.date >= filter.date.$gte && row.date <= filter.date.$lte));
      return { deletedCount: before - rows.length };
    } } },
  };
  const module = new SourceTextModule(await readFile(new URL('../src/app/api/dailystocks/delete/route.js', import.meta.url), 'utf8'));
  await module.link(async name => {
    const exports = mocks[name];
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    });
  });
  await module.evaluate();
  return { call: body => module.namespace.POST({ json: async () => body }), rows: () => rows, connects: () => connects };
}

test('deletes inclusive range only for the requested branch', async () => {
  const f = await fixture();
  const result = await f.call({ branch: 'Asawann', startDate: '2026-10-02', endDate: '2026-10-03' });
  assert.equal(result.status, 200);
  assert.equal(result.data.deleted, 2);
  assert.deepEqual(f.rows(), [
    { branch: 'Asawann', date: '2026-10-01' },
    { branch: 'Asawann', date: '2026-10-04' },
    { branch: 'Other', date: '2026-10-02' },
  ]);
});

test('supports legacy single-day deletion and reports no matches', async () => {
  const f = await fixture();
  const body = { branch: 'Asawann', date: '2026-10-02' };
  assert.equal((await f.call(body)).data.deleted, 1);
  assert.equal((await f.call(body)).status, 404);
  assert.equal(f.rows().length, 4);
});

test('rejects malformed ranges and branch selectors before connecting', async () => {
  const valid = { branch: 'Asawann', startDate: '2026-10-02', endDate: '2026-10-03' };
  for (const patch of [
    { startDate: '2026-10-04' }, { startDate: '2026-02-30' },
    { startDate: '2026-1-02' }, { startDate: { $ne: null } },
    { endDate: undefined }, { branch: 'ALL' }, { branch: '' },
    { branch: { $ne: null } },
  ]) {
    const f = await fixture();
    assert.equal((await f.call({ ...valid, ...patch })).status, 400);
    assert.equal(f.connects(), 0);
    assert.equal(f.rows().length, 5);
  }
});

test('requires admin authorization before deletion', async () => {
  for (const role of ['user', null]) {
    const f = await fixture(role);
    assert.equal((await f.call({ branch: 'Asawann', date: '2026-10-02' })).status, 403);
    assert.equal(f.connects(), 0);
    assert.equal(f.rows().length, 5);
  }
});

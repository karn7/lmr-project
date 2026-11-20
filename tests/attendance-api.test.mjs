import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SourceTextModule, SyntheticModule } from 'node:vm';
import * as helpers from '../lib/attendance.mjs';

async function fixture(role = 'admin', fail = false) {
  const calls = [];
  const query = {
    select(fields) { calls.push({ fields }); return this; },
    sort(order) { calls.push({ order }); return this; },
    async lean() { if (fail) throw new Error('test database failure'); return []; },
  };
  const mocks = {
    'next/server': { NextResponse: { json: (data, options = {}) => ({ data, status: options.status || 200, headers: options.headers }) } },
    'next-auth/jwt': { getToken: async () => role ? { role } : null },
    '../../../../../lib/mongodb': { connectMongoDB: async () => calls.push('connect') },
    '../../../../../models/attendance': { default: {
      find(filter) { calls.push({ filter }); return query; },
      async aggregate() { return [{ employee: 'old-user', fullnameTh: 'พนักงานเดิม', employeeCode: 'E01' }]; },
    } },
    '../../../../../lib/attendance.mjs': helpers,
  };
  const module = new SourceTextModule(await readFile(new URL('../src/app/api/admin/attendance/route.js', import.meta.url), 'utf8'));
  await module.link((name) => new SyntheticModule(Object.keys(mocks[name]), function () {
    for (const [key, value] of Object.entries(mocks[name])) this.setExport(key, value);
  }));
  await module.evaluate();
  return { calls, get: (query = '') => module.namespace.GET({ url: `https://example.test/api/admin/attendance?${query}` }) };
}

test('rejects unauthenticated and non-admin requests before database access', async () => {
  for (const [role, status] of [[null, 401], ['user', 403]]) {
    const f = await fixture(role);
    for (const query of ['month=2026-11', 'options=1']) assert.equal((await f.get(query)).status, status);
    assert.deepEqual(f.calls, []);
  }
});

test('rejects missing or invalid months before database access', async () => {
  const f = await fixture();
  for (const query of ['', 'month=2026-13', 'month=2026-1']) assert.equal((await f.get(query)).status, 400);
  assert.deepEqual(f.calls, []);
});

test('filters month and employee exactly and excludes identity/card data', async () => {
  const f = await fixture();
  const result = await f.get('month=2026-12&employee=staff%2B1%40example.com');
  assert.equal(result.status, 200);
  assert.deepEqual(f.calls[1].filter, { date: { $gte: '2026-12-01', $lt: '2027-01-01' }, employee: 'staff+1@example.com' });
  assert.doesNotMatch(f.calls[2].fields, /citizenId|cardData|employeeEmail/);
  assert.equal(result.headers['Cache-Control'], 'no-store');
  assert.deepEqual(result.data.records, []);
});

test('all-employee view has no employee restriction and options include historical employees', async () => {
  const f = await fixture();
  await f.get('month=2026-11');
  assert.equal('employee' in f.calls[1].filter, false);
  assert.deepEqual((await f.get('options=1')).data.employees, [{ value: 'old-user', label: 'พนักงานเดิม (E01)' }]);
});

test('database failures produce a recoverable error without database details', async () => {
  const f = await fixture('admin', true);
  const result = await f.get('month=2026-11');
  assert.equal(result.status, 500);
  assert.doesNotMatch(result.data.message, /test database failure/);
});

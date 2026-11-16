import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SourceTextModule, SyntheticModule } from 'node:vm';

async function fixture(role = 'admin', empty = false) {
  const calls = [];
  const mocks = {
    'next/server': { NextResponse: { json: (data, options = {}) => ({ data, status: options.status || 200 }) } },
    'next-auth/jwt': { getToken: async () => role ? { role } : null },
    '../../../../../lib/mongodb': { connectMongoDB: async () => calls.push('connect') },
    '../../../../../models/Customer': { default: {
      distinct: async () => ['US', 'TH', '', null],
      aggregate: async (pipeline) => {
        calls.push(pipeline);
        return [{ items: empty ? [] : [{ _id: 'customer-1', nationality: 'TH' }], count: empty ? [] : [{ total: 7 }] }];
      },
    } },
    '../../../../../models/record': { default: { distinct: async (field, filter) => { calls.push({ field, filter }); return ['ABC123', null, '']; } } },
  };
  const module = new SourceTextModule(await readFile(new URL('../src/app/api/customers/random/route.js', import.meta.url), 'utf8'));
  await module.link((name) => new SyntheticModule(Object.keys(mocks[name]), function () {
    for (const [key, value] of Object.entries(mocks[name])) this.setExport(key, value);
  }));
  await module.evaluate();
  return { calls, get: (query = '') => module.namespace.GET({ url: `https://example.test/api/customers/random?${query}` }) };
}

test('random customer API requires admin before database access', async () => {
  for (const [role, status] of [[null, 401], ['user', 403]]) {
    const f = await fixture(role);
    assert.equal((await f.get()).status, status);
    assert.deepEqual(f.calls, []);
  }
});

test('validates nationality and actual calendar dates before querying', async () => {
  const f = await fixture();
  for (const query of ['nationality=USA', 'date=2026-02-30', 'date=invalid']) assert.equal((await f.get(query)).status, 400);
  assert.deepEqual(f.calls, []);
});

test('options return sorted valid nationality codes', async () => {
  const f = await fixture();
  assert.deepEqual((await f.get('options=1')).data.nationalities, ['TH', 'US']);
});

test('samples all customers without transaction lookup when all dates and nationalities selected', async () => {
  const f = await fixture();
  const result = await f.get();
  assert.equal(result.data.customer.id, 'customer-1');
  assert.equal(result.data.total, 7);
  assert.deepEqual(f.calls[1][0], { $match: {} });
  assert.deepEqual(f.calls[1][1].$facet.items[0], { $sample: { size: 1 } });
});

test('combines nationality with transaction date using Bangkok day boundaries', async () => {
  const f = await fixture();
  await f.get('nationality=TH&date=2026-10-01');
  assert.equal(f.calls[1].field, 'customerId');
  assert.equal(f.calls[1].filter.$or[0].date, '2026-10-01');
  const range = f.calls[1].filter.$or[1].createdAt;
  assert.equal(range.$gte.toISOString(), '2026-09-30T17:00:00.000Z');
  assert.equal(range.$lt.toISOString(), '2026-10-01T17:00:00.000Z');
  assert.deepEqual(f.calls[2][0].$match, { nationality: 'TH', idNumber: { $in: ['ABC123'] } });
});

test('supports nationality only, date only, and empty results', async () => {
  const nationality = await fixture();
  await nationality.get('nationality=US');
  assert.deepEqual(nationality.calls[1][0].$match, { nationality: 'US' });
  const date = await fixture('admin', true);
  const result = await date.get('date=2026-10-01');
  assert.deepEqual(date.calls[2][0].$match, { idNumber: { $in: ['ABC123'] } });
  assert.equal(result.data.customer, null);
  assert.equal(result.data.total, 0);
});

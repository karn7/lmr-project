import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SourceTextModule, SyntheticModule } from 'node:vm';
import * as helpers from '../lib/customer-signatures.mjs';

const targetId = '0123456789abcdef01234567';
const sourceId = '0123456789abcdef01234568';
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
async function fixture({ role = 'admin', targetCustomer = 'ID1234', sourceCustomer = 'ID1234', conflict = false, sourceImage = png } = {}) {
  const calls = { connects: 0, reads: [], updates: [] };
  const chain = (value) => {
    const query = { select: () => query, sort: () => query, skip: () => query, limit: () => query, lean: async () => value, then: (resolve, reject) => Promise.resolve(value).then(resolve, reject) };
    return query;
  };
  const mocks = {
    'next/server': { NextResponse: { json: (data, options = {}) => ({ data, status: options.status || 200 }) } },
    'next-auth/jwt': { getToken: async () => role ? { role, email: 'admin@example.test' } : null },
    mongoose: { default: { isValidObjectId: value => typeof value === 'string' && /^[a-f0-9]{24}$/.test(value) } },
    '../../../../../lib/mongodb': { connectMongoDB: async () => { calls.connects++; } },
    '../../../../../models/user': { default: { distinct: async () => ['Branch A'] } },
    '../../../../../lib/customer-signatures.mjs': helpers,
    '../../../../../models/record': { default: {
      distinct: async (field) => field === 'branch' ? ['Branch B'] : ['Buying', 'Deposit'],
      findById: (id) => chain(id === targetId ? { _id: id, customerId: targetCustomer } : id === sourceId ? { _id: id, customerId: sourceCustomer, customerSignature: { image: sourceImage } } : null),
      find: (filter) => { calls.reads.push(filter); return chain([{ _id: targetId, docNumber: 'B001' }]); },
      countDocuments: async () => 1,
      findOneAndUpdate: (filter, update) => { calls.updates.push({ filter, update }); return chain(conflict ? null : { _id: targetId }); },
    } },
  };
  const module = new SourceTextModule(await readFile(new URL('../src/app/api/audit/missing-signatures/route.js', import.meta.url), 'utf8'));
  await module.link(async name => {
    assert.ok(mocks[name], `Unexpected import ${name}`);
    const values = mocks[name];
    return new SyntheticModule(Object.keys(values), function () { for (const [key, value] of Object.entries(values)) this.setExport(key, value); });
  });
  await module.evaluate();
  return {
    calls,
    get: (qs) => module.namespace.GET({ url: `http://localhost/api/audit/missing-signatures?${qs}` }),
    post: (values) => module.namespace.POST({ headers: new Headers(), formData: async () => ({ get: key => values[key] ?? null }) }),
  };
}
const upload = (bytes = png) => ({ recordId: targetId, file: { size: bytes.length, arrayBuffer: async () => bytes } });

test('validates single calendar days and uses Bangkok boundaries with legacy fallback', () => {
  assert.equal(helpers.signatureDay('2026-02-29'), null);
  assert.equal(helpers.signatureDay('2026-10-08,2026-10-09'), null);
  const day = helpers.signatureDay('2026-10-08');
  assert.equal(day.$or[0].date, '2026-10-08');
  assert.equal(day.$or[1].createdAt.$gte.toISOString(), '2026-10-07T17:00:00.000Z');
  assert.equal(day.$or[1].createdAt.$lt.toISOString(), '2026-10-08T17:00:00.000Z');
});
test('requires admin for reads and writes before connecting to database', async () => {
  for (const [role, status] of [[null, 401], ['user', 403]]) {
    const f = await fixture({ role });
    assert.equal((await f.get('options=1')).status, status);
    assert.equal((await f.post(upload())).status, status);
    assert.equal(f.calls.connects, 0);
  }
});
test('filters missing image data by date, branch and transaction type', async () => {
  const f = await fixture();
  assert.equal((await f.get('date=invalid')).status, 400);
  const res = await f.get('date=2026-10-08&branch=Branch+A&payType=Buying');
  assert.equal(res.status, 200);
  assert.equal(f.calls.reads[0].branch, 'Branch A');
  assert.equal(f.calls.reads[0].payType, 'Buying');
  assert.deepEqual(f.calls.reads[0].$and[1], helpers.missingSignature);
  assert.equal(JSON.stringify(f.calls.reads[0]).includes('signatureConfirmed'), false);
});
test('options include historical branches and transaction types', async () => {
  const res = await (await fixture()).get('options=1');
  assert.deepEqual(res.data.branches, ['Branch A', 'Branch B']);
  assert.ok(res.data.payTypes.includes('Deposit'));
});
test('signature history is scoped to exact customer identity, never customer name', async () => {
  const f = await fixture();
  assert.equal((await f.get(`recordId=${targetId}`)).status, 200);
  assert.deepEqual(f.calls.reads[0], { customerId: 'ID1234', _id: { $ne: targetId }, $nor: [helpers.missingSignature] });
  const unidentified = await fixture({ targetCustomer: '' });
  assert.equal((await unidentified.get(`recordId=${targetId}`)).data.total, 0);
  assert.equal(unidentified.calls.reads.length, 0);
});
test('upload records image, confirmation and provenance with an atomic missing-image guard', async () => {
  const f = await fixture();
  assert.equal((await f.post(upload())).status, 200);
  const { filter, update } = f.calls.updates[0];
  assert.deepEqual(filter, { _id: targetId, customerId: 'ID1234', ...helpers.missingSignature });
  assert.equal(update.$set.signatureConfirmed, true);
  assert.equal(update.$set.customerSignature.contentType, 'image/png');
  assert.equal(update.$set.customerSignature.addedBy, 'admin@example.test');
  assert.equal(update.$set.customerSignature.source, 'upload');
  assert.deepEqual(update.$set.customerSignature.image, png);
  assert.deepEqual(Object.keys(update.$set).sort(), ['customerSignature', 'signatureConfirmed']);
});
test('rejects unsafe/oversized uploads and ambiguous or invalid sources without a write', async () => {
  const f = await fixture();
  for (const values of [
    upload(Buffer.from('<svg>not a signature</svg>')),
    { recordId: targetId, file: { size: helpers.MAX_SIGNATURE_BYTES + 1 } },
    { ...upload(), sourceRecordId: sourceId },
    { recordId: targetId, sourceRecordId: targetId },
    { recordId: 'bad-id', sourceRecordId: sourceId },
  ]) assert.equal((await f.post(values)).status, 400);
  assert.equal(f.calls.updates.length, 0);
});
test('saves drawn PNG signatures with provenance and the existing validation and conflict guard', async () => {
  const values = { ...upload(), source: 'draw' };
  const f = await fixture();
  assert.equal((await f.post(values)).status, 200);
  assert.equal(f.calls.updates[0].update.$set.customerSignature.source, 'draw');
  assert.equal(f.calls.updates[0].update.$set.customerSignature.contentType, 'image/png');
  assert.deepEqual(f.calls.updates[0].update.$set.customerSignature.image, png);
  const invalid = await fixture();
  assert.equal((await invalid.post({ ...upload(Buffer.from('invalid')), source: 'draw' })).status, 400);
  assert.equal(invalid.calls.updates.length, 0);
  assert.equal((await (await fixture({ conflict: true })).post(values)).status, 409);
});
test('copies only the same customer signature and rejects missing sources and concurrent updates', async () => {
  const values = { recordId: targetId, sourceRecordId: sourceId };
  const f = await fixture();
  assert.equal((await f.post(values)).status, 200);
  assert.equal(f.calls.updates[0].update.$set.customerSignature.sourceRecordId, sourceId);
  for (const options of [{ sourceCustomer: 'OTHER' }, { targetCustomer: '' }]) {
    const invalid = await fixture(options);
    assert.equal((await invalid.post(values)).status, 400);
    assert.equal(invalid.calls.updates.length, 0);
  }
  assert.equal((await (await fixture({ sourceImage: null })).post(values)).status, 409);
  assert.equal((await (await fixture({ conflict: true })).post(upload())).status, 409);
});

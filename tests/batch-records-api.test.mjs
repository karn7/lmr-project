// Run with node --experimental-vm-modules --test tests/batch-records-api.test.mjs
// In-memory model doubles exercise route behavior without accessing the real database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SourceTextModule, SyntheticModule } from 'node:vm';
import { createHash } from 'node:crypto';
import * as calculations from '../lib/batch-records.mjs';

const employeeId = '0123456789abcdef01234567', shiftId = '0123456789abcdef01234568';
const batchId = '01234567-89ab-cdef-0123-456789abcdef';
const body = { date: '2020-01-12', employeeId, shiftId, payType: 'Buying', cashMode: 'adjust-shift', reason: 'Actual transaction entered later', rows: [
  { time: '10:00', customerName: 'Test Customer', idType: 'passport', idNumber: 'AB123456', nationality: 'US', currency: 'USD', amount: 100, rate: 35, payMethod: 'cash', receiveMethod: 'cash' },
] };
const clone = (value) => structuredClone(value);
const wrap = (value) => ({ ...value, toObject: () => clone(value), items: value.items?.map((i) => ({ ...i, toObject: () => clone(i) })) });

async function fixture({ role = 'admin', failAudit = false } = {}) {
  let db = {
    users: [{ _id: employeeId, name: 'Employee', employeeCode: '01', branch: 'Main', country: 'Thai' }],
    shifts: [{ _id: shiftId, date: body.date, employee: 'Employee', branch: 'Main', shiftNo: 1, createdAt: '2020-01-12T01:00:00.000Z', closedAt: '2020-01-12T11:00:00.000Z', cashBalance: { USD: 500, THB: 10000 } }],
    records: [{ _id: 'old-record', docNumber: 'B-01-200112001', employee: 'Employee', branch: 'Main', payType: 'Buying', createdAt: '2020-01-12T04:00:00.000Z' }],
    counters: [{ date: '200112', prefix: 'B-01', count: 1 }], customers: [], batches: [],
    deletions: [], logs: [{ docNumber: 'B-01-200112001' }], notifications: [{ docNumber: 'B-01-200112001' }],
  };
  const tx = { transaction: true };
  const mutations = [];
  function query(value) {
    return { session() { return this; }, sort() { return this; }, select() { return this; }, limit() { return this; }, lean() { return Promise.resolve(clone(value)); }, then(resolve, reject) { return Promise.resolve(clone(value)).then(resolve, reject); } };
  }
  function mutated(kind, options) { assert.equal(options.session, tx, `${kind} must use the transaction`); mutations.push(kind); }
  function documentQuery(value, decorate) {
    return { session() { return this; }, then(resolve, reject) { return Promise.resolve(value ? decorate(clone(value)) : null).then(resolve, reject); } };
  }
  const Record = {
    findOne: (filter) => documentQuery(db.records.find((r) => filter._id ? r._id === filter._id : r.docNumber === filter.docNumber), wrap),
    deleteOne: async (filter, options) => { mutated('delete-record', options); db.records = db.records.filter((r) => r._id !== filter._id); },
    find: (filter) => query(db.records.filter((r) => new RegExp(filter.docNumber.$regex).test(r.docNumber))),
    bulkWrite: async (operations, options) => {
      mutated('record-update', options);
      for (const { updateOne: op } of operations) {
        const r = db.records.find((r) => r._id === op.filter._id);
        Object.assign(r, op.update.$set);
        if (op.update.$push) (r.docNumberHistory ||= []).push(op.update.$push.docNumberHistory);
      }
    },
    insertMany: async (documents, options) => { mutated('record-insert', options); const rows = documents.map((d, i) => ({ ...d, _id: `new-${i}` })); db.records.push(...clone(rows)); return rows.map(wrap); },
  };
  const User = { findById: (id) => query(db.users.find((u) => u._id === id)), countDocuments: () => query(1) };
  const Shift = {
    findById: (id) => documentQuery(db.shifts.find((s) => s._id === id), (value) => {
      const document = { ...value, editLogs: value.editLogs || [] };
      document.save = async (options) => { mutated('shift-save', options); const { save, ...data } = document; db.shifts[0] = clone(data); };
      return document;
    }),
    findOne: () => query(db.shifts[0]),
    updateOne: async (filter, update, options) => { mutated('shift', options); Object.assign(db.shifts[0], update.$set); },
  };
  const Counter = {
    find: (filter) => query(db.counters.filter((c) => c.date === filter.date && c.prefix === filter.prefix)),
    updateOne: async (filter, update, options) => {
      mutated('counter', options);
      let counter = db.counters.find((c) => c.date === filter.date && c.prefix === filter.prefix);
      if (!counter) { counter = { ...filter, count: 0 }; db.counters.push(counter); }
      counter.count = Math.max(counter.count, update.$max.count);
    },
  };
  const Customer = {
    findOne: (filter) => query(db.customers.find((c) => c.idNumber === filter.idNumber) || null),
    create: async (rows, options) => { mutated('customer', options); db.customers.push(...clone(rows)); },
  };
  const references = (key) => ({
    updateMany: async (filter, pipeline, options) => {
      mutated(key, options);
      const branches = pipeline[0].$set.docNumber.$switch.branches;
      for (const r of db[key]) { const branch = branches.find((b) => b.case.$eq[1] === r.docNumber); if (branch) r.docNumber = branch.then; }
    },
    insertMany: async (rows, options) => { mutated(key, options); db[key].push(...clone(rows)); },
  });
  const RecordBatch = {
    findById: (id) => query(db.batches.find((b) => b._id === id) || null),
    create: async (rows, options) => { mutated('audit', options); if (failAudit) throw new Error('Simulated audit failure'); db.batches.push(...clone(rows)); return rows.map(wrap); },
  };
  const mocks = {
    'next/server': { NextResponse: { json: (data, options = {}) => ({ status: options.status || 200, data }) } },
    'next-auth/jwt': { getToken: async () => role ? { role, email: 'admin@example.test' } : null },
    crypto: { createHash }, mongoose: { default: { isValidObjectId: (v) => /^[a-f\d]{24}$/.test(v || '') } },
    '../../../../../lib/mongodb': { connectMongoDB: async () => {} },
    '../../../../../lib/record-numbering': { withRecordNumbering: async (work) => {
      const before = clone(db);
      try { return await work(tx); } catch (e) { db = before; throw e; }
    } },
    '../../../../../lib/batch-records.mjs': calculations,
  };
  for (const [name, model] of Object.entries({ record: Record, recordBatch: RecordBatch, counter: Counter, user: User, shift: Shift, Customer, post: { distinct: () => query(['USD']) }, adjustmentLog: references('logs'), notifications: references('notifications'), deleteLog: { create: async (rows, options) => { mutated('delete-audit', options); db.deletions.push(...clone(rows)); } } })) mocks[`../../../../../models/${name}`] = { default: model };
  async function loadRoute(path) {
    const routeModule = new SourceTextModule(await readFile(new URL(path, import.meta.url), 'utf8'));
    await routeModule.link((specifier) => {
    const exports = mocks[specifier];
    assert.ok(exports, `unexpected import ${specifier}`);
    return new SyntheticModule(Object.keys(exports), function () { for (const [key, value] of Object.entries(exports)) this.setExport(key, value); });
  });
    await routeModule.evaluate();
    return (payload) => routeModule.namespace.POST({ json: async () => payload });
  }
  return { call: await loadRoute('../src/app/api/record/batch/route.js'), remove: await loadRoute('../src/app/api/record/delete/route.js'), db: () => db, mutations };
}

test('requires admin authorization before reading or mutating data', async () => {
  for (const [role, status] of [[null, 401], ['user', 403]]) {
    const f = await fixture({ role });
    assert.equal((await f.call({ ...body, action: 'preview' })).status, status);
    assert.equal(f.mutations.length, 0);
  }
});
test('preview is read-only; save renumbers references, updates cash and counter, and records immutable history', async () => {
  const f = await fixture();
  const preview = await f.call({ ...body, action: 'preview' });
  assert.equal(preview.status, 200);
  assert.equal(f.mutations.length, 0);
  const response = await f.call({ ...body, action: 'save', snapshot: preview.data.snapshot, batchId });
  assert.equal(response.status, 201);
  assert.equal(f.db().records.find((r) => r._id === 'old-record').docNumber, 'B-01-200112002');
  assert.equal(f.db().records.find((r) => r._id === 'new-0').docNumber, 'B-01-200112001');
  assert.equal(f.db().logs[0].docNumber, 'B-01-200112002');
  assert.equal(f.db().notifications[0].docNumber, 'B-01-200112002');
  assert.deepEqual(f.db().shifts[0].cashBalance, { USD: 600, THB: 6500 });
  assert.equal(f.db().counters[0].count, 2);
  assert.equal(f.db().batches[0].renumbered[0].oldNumber, 'B-01-200112001');
  assert.equal(f.db().records[0].docNumberHistory.length, 1);
  assert.notEqual(new Date(f.db().records[1].recordedAt).getTime(), new Date(f.db().records[1].createdAt).getTime());
});
test('retrying the same save does not duplicate bills or balances', async () => {
  const f = await fixture();
  const preview = await f.call({ ...body, action: 'preview' });
  const save = { ...body, action: 'save', snapshot: preview.data.snapshot, batchId };
  assert.equal((await f.call(save)).status, 201);
  const state = clone(f.db());
  assert.equal((await f.call(save)).status, 201);
  assert.deepEqual(f.db(), state);
  assert.equal((await f.call({ ...save, reason: 'different payload' })).status, 409);
});
test('stale preview is rejected before any writes', async () => {
  const f = await fixture();
  const preview = await f.call({ ...body, action: 'preview' });
  f.db().counters[0].count += 1;
  assert.equal((await f.call({ ...body, action: 'save', snapshot: preview.data.snapshot, batchId })).status, 409);
  assert.equal(f.mutations.length, 0);
});
test('audit failure rolls back records, references, customers, cash and counter', async () => {
  const f = await fixture({ failAudit: true });
  const before = clone(f.db());
  const preview = await f.call({ ...body, action: 'preview' });
  assert.equal((await f.call({ ...body, action: 'save', snapshot: preview.data.snapshot, batchId })).status, 500);
  assert.ok(f.mutations.includes('record-insert'));
  assert.ok(f.mutations.includes('shift'));
  assert.deepEqual(f.db(), before);
});
test('already-accounted mode adds bills without changing shift balances', async () => {
  const f = await fixture();
  const input = { ...body, cashMode: 'already-accounted' };
  const preview = await f.call({ ...input, action: 'preview' });
  assert.equal((await f.call({ ...input, action: 'save', snapshot: preview.data.snapshot, batchId })).status, 201);
  assert.deepEqual(f.db().shifts[0].cashBalance, { USD: 500, THB: 10000 });
  assert.ok(!f.mutations.includes('shift'));
});


test('deleting an inserted bill reverses the original cash adjustment exactly once, even after shift closure', async () => {
  const f = await fixture();
  const preview = await f.call({ ...body, action: 'preview' });
  await f.call({ ...body, action: 'save', snapshot: preview.data.snapshot, batchId });
  const request = { recordId: 'new-0', docNumber: 'B-01-200112001' };
  assert.equal((await f.remove(request)).status, 200);
  assert.deepEqual(f.db().shifts[0].cashBalance, { USD: 500, THB: 10000 });
  assert.equal(f.db().deletions.length, 1);
  assert.equal(f.db().records.length, 1);
  assert.equal((await f.remove(request)).status, 404);
  assert.deepEqual(f.db().shifts[0].cashBalance, { USD: 500, THB: 10000 });
});
test('deletion preserves accounted cash and rejects stale numbers using immutable record ID', async () => {
  const f = await fixture();
  const input = { ...body, cashMode: 'already-accounted' };
  const preview = await f.call({ ...input, action: 'preview' });
  await f.call({ ...input, action: 'save', snapshot: preview.data.snapshot, batchId });
  assert.equal((await f.remove({ recordId: 'old-record', docNumber: 'B-01-200112001' })).status, 409);
  assert.equal((await f.remove({ recordId: 'new-0', docNumber: 'B-01-200112001' })).status, 200);
  assert.deepEqual(f.db().shifts[0].cashBalance, { USD: 500, THB: 10000 });
});


test('Asawann inserts into the shared B series across employees, branches and shifts, preserving signatures', async () => {
  const f = await fixture();
  f.db().users[0].branch = 'Asawann';
  delete f.db().users[0].employeeCode;
  f.db().shifts[0].branch = 'Asawann';
  Object.assign(f.db().records[0], { docNumber: 'B-200112001', branch: 'Other branch', employee: 'Other employee', shiftNo: '2', signatureConfirmed: true, customerSignature: { image: 'existing-signature' } });
  f.db().logs[0].docNumber = 'B-200112001';
  f.db().notifications[0].docNumber = 'B-200112001';
  f.db().counters.push({ date: '200112', prefix: 'B', count: 1 }, { date: '200112', prefix: 'S', count: 8 });
  const untouched = ['S-200112001', 'P-200112001', 'A-200112001', 'B-01-200112001', 'B-200111001'].map((docNumber, i) => ({ _id: `untouched-${i}`, docNumber }));
  f.db().records.push(...clone(untouched));
  const preview = await f.call({ ...body, action: 'preview' });
  assert.equal(preview.status, 200);
  assert.equal(preview.data.numbering.counterPrefix, 'B');
  assert.equal(preview.data.plan.length, 2);
  assert.equal(preview.data.plan[1].branch, 'Other branch');
  const saved = await f.call({ ...body, action: 'save', snapshot: preview.data.snapshot, batchId });
  assert.equal(saved.status, 201);
  assert.equal(f.db().records.find((r) => r._id === 'new-0').docNumber, 'B-200112001');
  const shifted = f.db().records.find((r) => r._id === 'old-record');
  assert.equal(shifted.docNumber, 'B-200112002');
  assert.equal(shifted.signatureConfirmed, true);
  assert.deepEqual(shifted.customerSignature, { image: 'existing-signature' });
  assert.equal(f.db().logs[0].docNumber, 'B-200112002');
  assert.equal(f.db().notifications[0].docNumber, 'B-200112002');
  assert.equal(f.db().counters.find((c) => c.prefix === 'B').count, 2);
  assert.equal(f.db().counters.find((c) => c.prefix === 'B-01').count, 1);
  assert.equal(f.db().counters.find((c) => c.prefix === 'S').count, 8);
  assert.deepEqual(f.db().records.filter((r) => r._id.startsWith('untouched-')), untouched);
});
test('Asawann Selling uses the independent S counter and rejects stale shared-counter previews', async () => {
  const f = await fixture();
  f.db().users[0].branch = 'Asawann';
  f.db().shifts[0].branch = 'Asawann';
  f.db().counters.push({ date: '200112', prefix: 'S', count: 0 });
  const input = { ...body, payType: 'Selling' };
  const preview = await f.call({ ...input, action: 'preview' });
  assert.equal(preview.data.plan[0].docNumber, 'S-200112001');
  f.db().counters.find((c) => c.prefix === 'S').count++;
  assert.equal((await f.call({ ...input, action: 'save', snapshot: preview.data.snapshot, batchId })).status, 409);
  assert.equal((await f.call({ ...input, action: 'preview' })).status, 409);
  f.db().records.push({ _id: 'signed-selling', docNumber: 'S-200112001', payType: 'Selling', branch: 'Asawann', employee: 'Employee', createdAt: '2020-01-12T04:00:00.000Z' });
  const fresh = await f.call({ ...input, action: 'preview' });
  assert.equal((await f.call({ ...input, action: 'save', snapshot: fresh.data.snapshot, batchId })).status, 201);
  assert.equal(f.db().records.find((r) => r._id === 'new-0').docNumber, 'S-200112001');
  assert.equal(f.db().records.find((r) => r._id === 'old-record').docNumber, 'B-01-200112001');
});

test('Asawann previews and saves signature-order mismatches without editing transaction times or signatures', async () => {
  const f = await fixture();
  f.db().users[0].branch = 'Asawann';
  f.db().shifts[0].branch = 'Asawann';
  Object.assign(f.db().records[0], { docNumber: 'B-200112001', signatureConfirmed: true, customerSignature: { image: 'signed' } });
  f.db().records.push({ _id: 'earlier', docNumber: 'B-200112002', employee: 'Other employee', branch: 'Other branch', payType: 'Buying', createdAt: '2020-01-12T02:00:00.000Z' });
  f.db().logs[0].docNumber = 'B-200112001';
  f.db().notifications[0].docNumber = 'B-200112002';
  f.db().counters.push({ date: '200112', prefix: 'B', count: 2 });
  const before = clone(f.db());
  const preview = await f.call({ ...body, action: 'preview' });
  assert.equal(preview.status, 200);
  assert.deepEqual(f.db(), before);
  assert.equal(preview.data.plan.filter((p) => p.timeReordered).length, 2);
  assert.equal((await f.call({ ...body, action: 'save', snapshot: preview.data.snapshot, batchId })).status, 201);
  const records = f.db().records;
  assert.equal(records.find((r) => r._id === 'earlier').docNumber, 'B-200112001');
  assert.equal(records.find((r) => r._id === 'new-0').docNumber, 'B-200112002');
  assert.equal(records.find((r) => r._id === 'old-record').docNumber, 'B-200112003');
  assert.equal(records.find((r) => r._id === 'old-record').signatureConfirmed, true);
  assert.deepEqual(records.find((r) => r._id === 'old-record').customerSignature, { image: 'signed' });
  assert.equal(records.find((r) => r._id === 'old-record').createdAt, before.records[0].createdAt);
  assert.equal(f.db().logs[0].docNumber, 'B-200112003');
  assert.equal(f.db().notifications[0].docNumber, 'B-200112001');
  assert.equal(f.db().counters.find((c) => c.prefix === 'B').count, 3);
});
test('API duplicate diagnostics expose stable record links and do not mutate data', async () => {
  const f = await fixture();
  f.db().records.push({ ...clone(f.db().records[0]), _id: 'duplicate' });
  const result = await f.call({ ...body, action: 'preview' });
  assert.equal(result.status, 400);
  assert.match(result.data.message, /B-01-200112001/);
  assert.deepEqual(result.data.issues.map((r) => r.recordId), ['old-record', 'duplicate']);
  assert.equal(f.mutations.length, 0);
});

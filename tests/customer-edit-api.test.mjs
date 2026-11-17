// Run with node --experimental-vm-modules --test tests/customer-edit-api.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SourceTextModule, SyntheticModule } from 'node:vm';

const id = '0123456789abcdef01234567';
async function fixture({ role = 'admin', conflict = false, failRecords = false } = {}) {
  let customer = { _id: id, id, fullName: 'Old Name', nationality: 'TH', idType: 'passport', idNumber: 'AB1234', createdBy: 'Original employee', contactInfo: { phone: '123', custom: { retained: true } } };
  let records = [{ customerId: 'AB1234', customerName: 'Old Name' }];
  let connected = false;
  let ended = false;
  const session = {
    async withTransaction(work) {
      const before = structuredClone({ customer, records });
      try { return await work(); } catch (error) { ({ customer, records } = before); throw error; }
    },
    async endSession() { ended = true; },
  };
  const mocks = {
    mongoose: { default: { Types: { ObjectId: { isValid: (value) => /^[a-f\d]{24}$/.test(value) } }, startSession: async () => session } },
    'next/server': { NextResponse: { json: (data, options = {}) => ({ status: options.status || 200, data }) } },
    'next-auth/jwt': { getToken: async () => role ? { role } : null },
    '../../../../../lib/mongodb': { connectMongoDB: async () => { connected = true; } },
    '../../../../../models/Customer': { default: {
      findById: () => ({ session: async (tx) => {
        assert.equal(tx, session);
        if (!customer) return null;
        const doc = structuredClone(customer);
        return Object.assign(doc, {
          async validate() {
            if (!doc.fullName || !doc.idNumber || !/^[A-Z]{2}$/.test(doc.nationality)) throw Object.assign(new Error('invalid'), { name: 'ValidationError' });
          },
          async save({ session: tx }) { assert.equal(tx, session); customer = this.toJSON(); },
          toJSON() { const { validate, save, toJSON, ...data } = this; return structuredClone(data); },
        });
      } }),
      exists: () => ({ session: async () => conflict }),
    } },
    '../../../../../models/record': { default: {
      async updateMany(filter, update, { session: tx }) {
        assert.equal(tx, session);
        if (failRecords) throw Object.assign(new Error('duplicate during update'), { code: 11000 });
        records = records.map((record) => record.customerId === filter.customerId ? { ...record, ...update.$set } : record);
      },
    } },
  };
  const module = new SourceTextModule(await readFile(new URL('../src/app/api/customers/[id]/route.js', import.meta.url), 'utf8'));
  await module.link((name) => {
    assert.ok(mocks[name], `Unexpected import ${name}`);
    return new SyntheticModule(Object.keys(mocks[name]), function () {
      for (const [key, value] of Object.entries(mocks[name])) this.setExport(key, value);
    });
  });
  await module.evaluate();
  return {
    call: (body, customerId = id) => module.namespace.PATCH({ json: async () => body }, { params: Promise.resolve({ id: customerId }) }),
    state: () => ({ customer, records, connected, ended }),
    removeCustomer: () => { customer = null; },
  };
}

test('only admins may edit customer profiles', async () => {
  for (const [role, status] of [[null, 401], ['user', 403]]) {
    const f = await fixture({ role });
    assert.equal((await f.call({ fullName: 'Changed' })).status, status);
    assert.equal(f.state().connected, false);
  }
});

test('normalizes profile edits, migrates record links and protects metadata', async () => {
  const f = await fixture();
  const response = await f.call({ fullName: '  New   Name ', nationality: 'la', idNumber: 'cd- 5678', createdBy: 'Tampered', _id: 'Tampered' });
  assert.equal(response.status, 200);
  assert.equal(response.data.customer.fullName, 'New Name');
  assert.equal(response.data.customer.nationality, 'LA');
  assert.equal(response.data.customer.idNumber, 'CD5678');
  assert.equal(response.data.customer.createdBy, 'Original employee');
  assert.equal(response.data.customer._id, id);
  assert.deepEqual(response.data.customer.contactInfo, { phone: '123', custom: { retained: true } });
  assert.deepEqual(f.state().records, [{ customerId: 'CD5678', customerName: 'Old Name' }]);
  assert.equal(f.state().ended, true);
});

test('rejects invalid values and missing customers', async () => {
  for (const body of [null, [], { isActive: 'false' }, { fullName: ' ' }, { nationality: 'THA' }, { documentExpiresAt: 'invalid' }, { contactInfo: [] }]) {
    const f = await fixture();
    assert.equal((await f.call(body)).status, 400);
    assert.equal(f.state().customer.fullName, 'Old Name');
  }
  const f = await fixture();
  assert.equal((await f.call({}, 'invalid')).status, 400);
  f.removeCustomer();
  assert.equal((await f.call({ fullName: 'New Name' })).status, 404);
});

test('rejects ambiguous document numbers without changing profiles or links', async () => {
  const f = await fixture({ conflict: true });
  assert.equal((await f.call({ idNumber: 'CD5678' })).status, 409);
  assert.equal(f.state().customer.idNumber, 'AB1234');
  assert.equal(f.state().records[0].customerId, 'AB1234');
});

test('rolls back profile changes if migration fails', async () => {
  const f = await fixture({ failRecords: true });
  assert.equal((await f.call({ idNumber: 'CD5678' })).status, 409);
  assert.equal(f.state().customer.idNumber, 'AB1234');
  assert.equal(f.state().records[0].customerId, 'AB1234');
  assert.equal(f.state().ended, true);
});

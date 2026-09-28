import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBatch, planNumbers, cashChanges, calculateTotalCents } from '../lib/batch-records.mjs';

const row = { time: '14:30', customerName: 'Test Customer', idType: 'passport', idNumber: 'AB123456', nationality: 'US', currency: 'USD', amount: '1000', rate: '35.125', payMethod: 'cash', receiveMethod: 'cash' };
const form = { date: '2026-01-12', payType: 'Buying', employeeId: '0123456789abcdef01234567', shiftId: '0123456789abcdef01234568', cashMode: 'adjust-shift', reason: 'Recorded after closing', rows: [row] };
const now = new Date('2026-01-13T00:00:00Z');
const stem = 'B-01-260112';
const old = (n, time) => ({ _id: String(n), docNumber: stem + String(n).padStart(3, '0'), createdAt: `2026-01-12T${time}:00+07:00` });
const added = (time) => ({ createdAt: `2026-01-12T${time}:00+07:00` });

test('rounds fractional cents without binary floating point errors', () => {
  assert.equal(calculateTotalCents(1, 1.005), 101);
  assert.equal(calculateTotalCents(1, 2.675), 268);
  assert.equal(calculateTotalCents(1000000, 1e-7), 10);
  assert.equal(calculateTotalCents(0.01, 1e8), 100000000);
});

test('normalizes identity, converts Thai actual time to UTC, calculates monetary total', () => {
  const output = validateBatch({ ...form, rows: [{ ...row, customerName: ' Test   Customer ', idNumber: 'ab-123 456', nationality: 'us', total: 1 }] }, now);
  assert.equal(output.rows[0].createdAt, '2026-01-12T07:30:00.000Z');
  assert.equal(output.rows[0].idNumber, 'AB123456');
  assert.equal(output.rows[0].customerName, 'Test Customer');
  assert.equal(output.rows[0].total, 35125);
});
test('rejects future, invalid calendar date and time', () => {
  for (const patch of [{ date: '2026-02-30' }, { date: '2027-01-12' }, { rows: [{ ...row, time: '25:00' }] }]) assert.throws(() => validateBatch({ ...form, ...patch }, now));
});
test('rejects invalid money, unsafe currency fields and incomplete identity', () => {
  for (const patch of [{ amount: 0 }, { amount: -1 }, { amount: 'NaN' }, { amount: '1.001' }, { rate: Infinity }, { rate: 0 }, { currency: '$USD' }, { currency: '__proto__' }, { customerName: '' }, { idNumber: '' }, { idType: 'thai_id', idNumber: '1234' }, { nationality: 'USA' }, { payMethod: 'other' }]) assert.throws(() => validateBatch({ ...form, rows: [{ ...row, ...patch }] }, now));
});
test('requires an explicit cash choice and bounds the batch', () => {
  for (const patch of [{ cashMode: '' }, { reason: '' }, { rows: [] }, { rows: Array(101).fill(row) }, { payType: 'Lottery' }]) assert.throws(() => validateBatch({ ...form, ...patch }, now));
  assert.equal(validateBatch({ ...form, rows: Array(100).fill(row) }, now).rows.length, 100);
});
test('inserts at actual times and shifts only following numbers', () => {
  const plan = planNumbers([old(1, '09:00'), old(2, '11:00'), old(3, '16:00')], [added('10:00'), added('15:00')], stem);
  assert.deepEqual(plan.map((p) => p.sequence), [1, 2, 3, 4, 5]);
  assert.deepEqual(plan.map((p) => p.isNew), [false, true, false, true, false]);
  assert.equal(plan[0].oldNumber, plan[0].docNumber);
  assert.equal(plan[2].oldNumber, `${stem}002`);
  assert.equal(plan[2].docNumber, `${stem}003`);
});
test('same-time existing bills stay before additions; input order resolves new ties', () => {
  const plan = planNumbers([old(1, '10:00')], [added('10:00'), added('10:00')], stem);
  assert.deepEqual(plan.map((p) => [p.isNew, p.index]), [[false, undefined], [true, 0], [true, 1]]);
});
test('supports beginning, end, empty days, gaps and sequences above 999', () => {
  assert.deepEqual(planNumbers([old(1, '10:00')], [added('09:00'), added('11:00')], stem).map((p) => p.sequence), [1, 2, 3]);
  assert.equal(planNumbers([], [added('09:00')], stem)[0].docNumber, `${stem}001`);
  assert.deepEqual(planNumbers([old(1, '09:00'), old(5, '11:00')], [added('10:00')], stem).map((p) => p.sequence), [1, 2, 6]);
  assert.equal(planNumbers([old(999, '09:00')], [added('10:00')], stem)[1].docNumber, `${stem}1000`);
});
test('rejects ambiguous existing order and duplicates', () => {
  assert.throws(() => planNumbers([old(2, '09:00'), old(1, '10:00')], [added('11:00')], stem));
  assert.throws(() => planNumbers([old(1, '09:00'), old(1, '10:00')], [added('11:00')], stem));
});
test('Buying and Selling cash directions respect cash/transfer and settlement currency', () => {
  const item = { currency: 'USD', amount: 1000, total: 35000, payMethod: 'cash', receiveMethod: 'cash' };
  assert.deepEqual(cashChanges(item, 'Buying'), [{ currency: 'USD', delta: 1000 }, { currency: 'THB', delta: -35000 }]);
  assert.deepEqual(cashChanges(item, 'Selling'), [{ currency: 'USD', delta: -1000 }, { currency: 'THB', delta: 35000 }]);
  assert.deepEqual(cashChanges({ ...item, payMethod: 'transfer' }, 'Buying'), [{ currency: 'THB', delta: -35000 }]);
  assert.deepEqual(cashChanges({ ...item, receiveMethod: 'transfer' }, 'Selling', 'LAK'), [{ currency: 'LAK', delta: 35000 }]);
  assert.deepEqual(cashChanges({ ...item, payMethod: 'transfer', receiveMethod: 'transfer' }, 'Buying'), []);
});

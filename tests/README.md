# Backdated batch records

Run validation, numbering, cash-direction and API regression tests without accessing MongoDB:

```sh
node --experimental-vm-modules --test tests/batch-records*.test.mjs
```

The API tests use in-memory model doubles. They cover admin authorization, read-only previews, stale previews, duplicate save retries, renumbered references, recorded timestamps, cash modes and rollback after a simulated audit failure. They do not replace an integration test against a disposable MongoDB replica set.

## Usage

Open **รายงานรายการ → เพิ่มบิลย้อนหลังหลายรายการ** (`/admin/report/batch-records`). Choose the actual transaction date, Buying/Selling, employee and original shift. Add up to 100 bills with actual times, customer identity, currency, amount, rate and payment methods. Existing customers can be looked up by document type and number; new customers are created atomically with the batch.

Choose whether cash is already included in the shift balance or should be adjusted. Adjustments change only the selected shift's expected cash balance. Counted closing balances and subsequent shift opening balances are not rewritten. Thai employees settle in THB and Laos employees in LAK.

Preview all document-number changes before saving. Numbers are ordered within the existing type/employee/date series; bills at identical times retain existing bills first, then new bills in input order. Existing gaps are preserved where possible. Duplicate existing numbers block insertion and identify both records. Nonchronological employee-code series also require review. Historical printed/exported documents keep their printed numbers; the permanent batch audit and each record's number history map old numbers to new ones. New report/detail links use immutable record IDs.

## Database requirement and deployment check

Number allocation, ordinary record creation, batch insertion/renumbering, cash updates and deletion now use MongoDB transactions with a shared numbering lock. **MongoDB must run as a replica set or a sharded cluster supporting transactions**, including in local development. A standalone MongoDB server is not supported by these write paths. Deploy the frontend and API together so normal Buying/Selling cash-update requests send immutable record IDs.

Before deploying, run an integration check against a disposable replica set: create a shift and two bills; preview an insertion between them; save; verify records, counters, customer links, cash logs, notifications, and audit; repeat the save to confirm idempotency; race a normal bill creation with a batch save and verify rejection of a stale preview. Test both cash modes and deletion/reversal of an inserted bill. No production records are needed for this check.

Audit batch documents have no TTL. Historical delete logs and older batch snapshots remain unchanged. Cash adjustment logs retain their existing retention policy; permanent numbering history is stored separately.


## Asawann shared numbering

For an employee whose branch is `Asawann` (case-insensitive), batch insertion uses `B-YYMMDDNNN` / `S-YYMMDDNNN` and counter keys `{date: YYMMDD, prefix: B or S}`. The requested historical date determines the batch series. All matching finalized B/S records in the database participate, across branches, employees and shifts; previews show their branch and employee. Other branches retain the employee-code format. P/A/NP records and employee-code series are not migrated. Renumbering preserves existing signatures and confirmation flags; it does not claim a new customer signature was collected.

If the shared counter is ahead of the final stored record, insertion is blocked until the outstanding number is saved or reconciled, rather than reusing a number issued by the external signature API. Asawann number/time mismatches caused by signature completion order are planned by assigning the existing numeric slots in transaction-time order before insertion. The preview explicitly flags this reordering; changes occur only on confirmation, and timestamps/signatures are preserved. Actual duplicate numbers remain blocked, with links to both records. The external `lmr-thai` application is read as a format reference only and is not modified; its transactionless number allocation/signature flow does not share this application's full transaction boundary. Cross-application concurrency must still be verified before live use.

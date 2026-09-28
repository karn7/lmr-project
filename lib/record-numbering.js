import mongoose, { Schema } from 'mongoose';
import { connectMongoDB } from './mongodb';
const Lock = mongoose.models.RecordNumberLock || mongoose.model('RecordNumberLock', new Schema({ _id: String, version: Number }));

// All number allocations and batch renumbering share this transaction lock.
export async function withRecordNumbering(work) {
  await connectMongoDB();
  try {
    await Lock.updateOne({ _id: 'records' }, { $setOnInsert: { version: 0 } }, { upsert: true });
  } catch (error) {
    // Another request may have initialized the lock at the same instant.
    if (error.code !== 11000) throw error;
  }
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      await Lock.updateOne({ _id: 'records' }, { $inc: { version: 1 } }, { session });
      return work(session);
    });
  } finally {
    await session.endSession();
  }
}

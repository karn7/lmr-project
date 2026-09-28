import mongoose, { Schema } from 'mongoose';
const schema = new Schema({
  _id: String,
  payloadHash: { type: String, required: true },
  recordedAt: { type: Date, required: true },
  recordedBy: { type: String, required: true },
  reason: String,
  date: String,
  payType: String,
  employee: String,
  branch: String,
  cashMode: String,
  shiftId: Schema.Types.ObjectId,
  inserted: [Schema.Types.Mixed],
  renumbered: [Schema.Types.Mixed],
}, { versionKey: false });
export default mongoose.models.RecordBatch || mongoose.model('RecordBatch', schema);

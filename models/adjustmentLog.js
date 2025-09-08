import mongoose, { Schema } from "mongoose";

const adjustmentLogSchema = new mongoose.Schema({
  createdAt: { type: Date, default: Date.now, expires: '7d' },
  docNumber: String,
  shiftNo: String,
  employee: String,
  action: { type: String, enum: ["increase", "decrease"] },
  currency: String,
  amount: Number,
  beforeAmount: Number,
  afterAmount: Number
});

export default mongoose.models.AdjustmentLog || mongoose.model("AdjustmentLog", adjustmentLogSchema);
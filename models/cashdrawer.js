import mongoose, { Schema } from "mongoose";

const cashDrawerSchema = new Schema({
  type: { type: String, required: true }, // increase/decrease
  currency: { type: String, required: true },
  amount: { type: Number, required: true },
  reason: { type: String, default: "" },
  user: { type: String, required: true },
  date: { type: String, required: true }, // format: YYYY-MM-DD
  shiftNo: { type: Number, required: true },
  branch: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: '30d' }
});

const CashDrawer = mongoose.models.CashDrawer || mongoose.model("CashDrawer", cashDrawerSchema);
export default CashDrawer;

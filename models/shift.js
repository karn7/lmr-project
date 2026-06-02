import mongoose, { Schema } from "mongoose";

const shiftSchema = new Schema({
  date: { type: String, required: true },
  shiftNo: { type: Number, required: true },
  branch: { type: String },
  country: { type: String },
  employee: { type: String },
  openAmount: { type: Object, default: {} },
  closeAmount: { type: Object, default: {} },
  cashBalance: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now },
  closedAt: { type: Date, default: null },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: String, default: "" },
  deleteReason: { type: String, default: "" },
  deleteLogs: { type: Array, default: [] },
  editLogs: { type: Array, default: [] },
  lastEditReason: { type: String, default: "" },
  updatedAt: { type: Date }
});

const Shift = mongoose.models.Shift || mongoose.model("Shift", shiftSchema);
export default Shift;

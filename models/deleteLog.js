

import mongoose, { Schema } from "mongoose";

const deleteLogSchema = new Schema({
  docNumber: String,
  deletedAt: Date,
  deletedBy: String,
  deletedData: Object,
});

export default mongoose.models.DeleteLog || mongoose.model("DeleteLog", deleteLogSchema);
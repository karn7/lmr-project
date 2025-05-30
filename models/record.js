import mongoose, { Schema } from "mongoose";

const recordSchema = new Schema({
  docNumber: String, // เช่น B680417001
  customerName: String,
  employee: String,
  branch: String,
  shiftNo: String,
  date: String,
  total: Number,
  payType: String, // "P" หรือ "NP"
  payMethod: {
    type: String, // "cash" หรือ "transfer"
  },
  payMethodNote: String,
  receiveMethod: {
    type: String, // "cash" หรือ "transfer"
  },
  receiveMethodNote: String,
  note: String,
  items: [
    {
      
      currency: String,
      unit: String,
      rate: Number,
      amount: Number,
      total: Number
    }
  ],
  createdAt: Date
}, { timestamps: false });

const Record = mongoose.models.Record || mongoose.model("Record", recordSchema);
export default Record;
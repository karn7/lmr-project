import mongoose, { Schema } from "mongoose";

const counterSchema = new Schema({
  date: String,
  prefix: String, // ✅ เพิ่มเพื่อแยก B / S
  count: Number
});

const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);
export default Counter;
import Counter from "../models/counter";
import { connectMongoDB } from "./mongodb";
import { withRecordNumbering } from "./record-numbering";

export default async function generateDocNumber(prefix, employee, employeeCode = "00", session = null) {
  if (!session) return withRecordNumbering((tx) => generateDocNumber(prefix, employee, employeeCode, tx));
  await connectMongoDB();

  const today = new Date();
  const year = today.getFullYear().toString().slice(-2); // "68"
  const month = (today.getMonth() + 1).toString().padStart(2, "0");
  const day = today.getDate().toString().padStart(2, "0");
  const dateStr = `${year}${month}${day}`;

  const counter = await Counter.findOneAndUpdate(
    { date: dateStr, prefix: `${prefix}-${employeeCode}` },
    { $inc: { count: 1 } },
    { upsert: true, new: true, session }
  );

  const number = counter.count.toString().padStart(3, "0");
  return `${prefix}-${employeeCode}-${dateStr}${number}`;
}

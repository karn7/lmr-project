import mongoose, { Schema } from 'mongoose';

const attendanceSchema = new Schema({
  date: { type: String, required: true },
  employee: { type: String, required: true, trim: true },
  employeeEmail: { type: String, trim: true, default: '' },
  employeeCode: { type: String, trim: true, default: '' },
  branch: { type: String, trim: true, default: '' },
  country: { type: String, trim: true, default: '' },
  citizenId: { type: String, required: true, trim: true },
  fullnameTh: { type: String, trim: true, default: '' },
  firstnameTh: { type: String, trim: true, default: '' },
  lastnameTh: { type: String, trim: true, default: '' },
  cardData: { type: Object, default: {} },
  checkInAt: { type: Date, required: true, default: Date.now },
  checkOutAt: { type: Date, default: null },
}, { timestamps: true });

attendanceSchema.index({ date: 1, employee: 1, createdAt: -1 });
attendanceSchema.index({ citizenId: 1, checkInAt: -1 });

export default mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema);

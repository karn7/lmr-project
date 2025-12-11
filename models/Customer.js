import mongoose, { Schema } from "mongoose";

const ALLOWED_ID_TYPES = ["passport", "thai_id"];

const customerSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
    // ISO 3166-1 alpha-2 เช่น TH, LA, US
    nationality: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      minlength: 2,
      maxlength: 2,
      validate: {
        validator: (v) => /^[A-Z]{2}$/.test(v || ""),
        message: "nationality ต้องเป็นรหัสประเทศ 2 ตัวอักษร (เช่น TH, LA, US)",
      },
    },
    idType: { type: String, required: true, enum: ALLOWED_ID_TYPES },
    idNumber: { type: String, required: true, trim: true, minlength: 4, maxlength: 64 },

    // optional metadata
    branch: { type: String, trim: true, default: "" },
    createdBy: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, maxlength: 1000, default: "" },
    isActive: { type: Boolean, default: true },

    // OPTIONAL denormalized fields (ไม่ใช่แหล่งความจริง)
    lastPurpose: { type: String, trim: true, maxlength: 200, default: "" }, // ใช้เพื่อ autofill UI ได้, ไม่บังคับ
    lastTransactionAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// unique ตามเอกสาร
customerSchema.index({ idType: 1, idNumber: 1 }, { unique: true });
// เร็วขึ้นเวลา search
customerSchema.index({ idNumber: 1 });

// ทำ normalization ให้ค้นหา/บันทึกเสถียร
customerSchema.pre("validate", function (next) {
  if (typeof this.idNumber === "string") {
    this.idNumber = this.idNumber.replace(/[\s-]+/g, "").toUpperCase();
  }
  next();
});

customerSchema.pre("save", function (next) {
  if (this.nationality) this.nationality = this.nationality.toUpperCase().trim();
  if (this.fullName) this.fullName = this.fullName.replace(/\s+/g, " ").trim();
  if (this.idNumber) this.idNumber = this.idNumber.trim();
  next();
});

// helper ค้นหาจากเอกสาร
customerSchema.statics.findByDocument = function (idType, idNumber) {
  const normalized = String(idNumber || "").replace(/[\s-]+/g, "").toUpperCase();
  return this.findOne({ idType, idNumber: normalized }).lean();
};

// JSON transform
customerSchema.set("toJSON", {
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

const Customer = mongoose.models.Customer || mongoose.model("Customer", customerSchema);
export default Customer;
import mongoose from "mongoose";

const dailyStockSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true,
    },
    branch: {
      type: String,
      required: true,
    },
    items: [
      {
        currency: {
          type: String,
          required: true,
        },
        carryOver: {
          type: Number,
          default: 0,
        },
        inOutTotal: {
          type: Number,
          default: 0,
        },
        averageRate: {
          type: Number,
          default: null,
        },
        actual: {
          type: Number,
          default: null,
        },
        difference: {
          type: Number,
          default: null,
        },
        finalized: {
          type: Boolean,
          default: false,
        },
      }
    ],
    createdBy: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.models.DailyStock ||
  mongoose.model("DailyStock", dailyStockSchema);
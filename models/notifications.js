import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    createdAt: {
      type: Date,
      default: Date.now,
    },
    docNumber: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    employee: {
      type: String,
      required: true,
    },
    details: {
      type: Object,
      default: {},
    },
    type: {
      type: String,
      enum: ["deleteRequest", "specialAction", "negativeBalance", "editRequest" , "systemError"],
      required: true,
    },
    status: {
      type: String,
      enum: ["unread", "read", "resolved"],
      default: "unread",
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Notification =
  mongoose.models.Notification || mongoose.model("Notification", notificationSchema);

export default Notification;
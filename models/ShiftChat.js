import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  sender: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const shiftChatSchema = new mongoose.Schema({
  shiftId: {
    type: String,
    required: true
  },
  employee: {
    type: String,
    required: true
  },
  branch: {
    type: String,
    required: true
  },
  date: {
    type: String,
    required: true
  },
  createdBy: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  messages: [messageSchema]
});

const ShiftChat = mongoose.models.ShiftChat || mongoose.model("ShiftChat", shiftChatSchema);
export default ShiftChat;

import { connectMongoDB } from "../../../../lib/mongodb";
import ShiftChat from "../../../../models/ShiftChat";
import { NextResponse } from "next/server";

// POST: Create a new ShiftChat document or add message to existing one
export async function POST(req) {
  try {
    await connectMongoDB();
    const { shiftId, sender, message, employee, branch, date, createdBy } = await req.json();

    if (!shiftId || !sender || !message || !employee || !branch || !date || !createdBy) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    let chat = await ShiftChat.findOne({ employee });

    const newMessage = {
      sender,
      message,
      timestamp: new Date()
    };

    if (!chat) {
      chat = new ShiftChat({
        shiftId,
        employee,
        branch,
        date,
        createdBy,
        messages: [newMessage]
      });
      console.log("Created new ShiftChat document:", chat);
    } else {
      chat.messages.push(newMessage);
    }

    await chat.save();

    return NextResponse.json({ success: true, chat });
  } catch (error) {
    console.error("❌ Error in POST /shiftchat:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH: Mark messages as read or update part of the conversation
export async function PATCH(req) {
  try {
    await connectMongoDB();
    const { employee, messageIndex, update } = await req.json();

    if (!employee || messageIndex === undefined || !update) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const chat = await ShiftChat.findOne({ employee });
    if (!chat || !chat.messages[messageIndex]) {
      return NextResponse.json({ success: false, error: "Chat or message not found" }, { status: 404 });
    }

    Object.assign(chat.messages[messageIndex], update);
    await chat.save();

    return NextResponse.json({ success: true, chat });
  } catch (error) {
    console.error("❌ Error in PATCH /shiftchat:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// GET: Fetch chat for a specific shift
export async function GET(req) {
  try {
    await connectMongoDB();
    const { searchParams } = new URL(req.url);
    const employee = searchParams.get("employee");

    let chats;
    if (employee) {
      chats = await ShiftChat.find({ employee }).sort({ createdAt: -1 });
    } else {
      chats = await ShiftChat.find().sort({ createdAt: -1 });
    }

    return NextResponse.json({ success: true, chats });
  } catch (error) {
    console.error("❌ Error in GET /shiftchat:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}


// DELETE: Remove chat data for a specific employee
export async function DELETE(req) {
  try {
    await connectMongoDB();
    const { employee } = await req.json();

    if (!employee) {
      return NextResponse.json({ success: false, error: "Missing employee" }, { status: 400 });
    }

    const result = await ShiftChat.deleteOne({ employee });

    if (result.deletedCount === 0) {
      return NextResponse.json({ success: false, error: "Chat not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Chat deleted successfully" });
  } catch (error) {
    console.error("❌ Error in DELETE /shiftchat:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
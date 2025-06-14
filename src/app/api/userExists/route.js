import { NextResponse } from "next/server";
import { connectMongoDB } from "../../../../lib/mongodb";
import User from "../../../../models/user";

export async function POST(req) {
    try {
        await connectMongoDB();
        const { email, employeeCode } = await req.json();
        const user = await User.findOne({
            $or: [{ email }, { employeeCode }]
        }).select("_id");
        console.log("Matched User by email or employeeCode:", user)

        return NextResponse.json({ user })

    } catch(error) {
        console.log(error);
    }
}
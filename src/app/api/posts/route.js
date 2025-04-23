import { connectMongoDB } from "../../../../lib/mongodb";
import Post from "../../../../models/post";
import { NextResponse } from "next/server";

export async function POST(req) {
    const { title, content, buy, sell, buylaos, selllaos } = await req.json();
    await connectMongoDB();
    await Post.create({ title, content, buy, sell, buylaos, selllaos });
    return NextResponse.json({ message: "Post created" }, { status: 201 });
}

export async function GET() {
    await connectMongoDB();
    const posts = await Post.find();
    return NextResponse.json({ posts });
  }

export async function DELETE(req) {
    const id = req.nextUrl.searchParams.get("id");
    await connectMongoDB();
    await Post.findByIdAndDelete(id);
    return NextResponse.json({ message: "Post Delete" }, { status: 200 })
}
import { NextResponse } from "next/server";
import { connectMongoDB } from "../../../../../lib/mongodb";
import Record from "../../../../../models/record";

export async function GET(req) {
  await connectMongoDB();

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode");
  const branch = searchParams.get("branch");

  // ✅ โหมด: ดึงรายชื่อสาขา
  if (mode === "branches") {
    const branches = await Record.distinct("branch");
    return NextResponse.json({ branches });
  }

  // ✅ โหมดปกติ: ดึงยอดย้อนหลัง 7 วัน
  const today = new Date();
  const start = new Date();
  start.setDate(today.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  today.setHours(23, 59, 59, 999);

  const matchCondition = {
    createdAt: {
      $gte: start,
      $lte: today
    }
  };

  if (branch && branch !== "all") {
    matchCondition.branch = branch;
  }

  const result = await Record.aggregate([
    { $match: matchCondition },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          branch: "$branch"
        },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: "$_id.date",
        branches: {
          $push: {
            k: "$_id.branch",
            v: "$count"
          }
        },
        total: { $sum: "$count" }
      }
    },
    {
      $project: {
        _id: 0,
        date: "$_id",
        branches: { $arrayToObject: "$branches" },
        total: 1
      }
    },
    { $sort: { date: 1 } }
  ]);

  const types = await Record.aggregate([
    { $match: matchCondition },
    {
      $group: {
        _id: "$payType", // หรือเปลี่ยนเป็น "payType" ตามที่ระบบใช้จริง
        count: { $sum: 1 }
      }
    }
  ]);

  const typesByBranch = await Record.aggregate([
    { $match: matchCondition },
    {
      $addFields: {
        date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }
      }
    },
    {
      $group: {
        _id: {
          payType: "$payType",
          branch: "$branch",
          date: "$date"
        },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: {
          payType: "$_id.payType",
          date: "$_id.date"
        },
        branches: {
          $push: {
            k: "$_id.branch",
            v: "$count"
          }
        }
      }
    },
    {
      $project: {
        _id: 1,
        branches: { $arrayToObject: "$branches" }
      }
    },
    {
      $addFields: {
        merged: {
          $mergeObjects: [
            { _id: "$_id" },
            "$branches"
          ]
        }
      }
    },
    {
      $replaceRoot: { newRoot: "$merged" }
    },
    { $sort: { "date": 1 } }
  ]);

  return NextResponse.json({ data: result, types, typesByBranch });
}
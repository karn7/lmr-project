import mongoose from "mongoose";

export const connectMongoDB = async () => {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URL;

    if (!uri) {
        throw new Error("Missing MONGODB_URI environment variable");
    }

    if (mongoose.connection.readyState === 1) {
        return;
    }

    await mongoose.connect(uri);
    console.log("Connected to MongoDB");
}

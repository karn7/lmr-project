import mongoose, { Schema } from "mongoose";

const postSchema = new Schema(
    {
        title: String,
        content: String,
        buy: Number,
        sell: Number,
        buylaos: Number,
        selllaos: Number
    },
)

const Post = mongoose.models.Post || mongoose.model("Post", postSchema);
export default Post;
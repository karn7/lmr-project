import mongoose, { Schema } from "mongoose";

const userSchema = new Schema(
    {
        name: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true
        },
        password: {
            type: String,
            required: true
        },
        role: {
            type: String,
            required: false,
        },
        branch: {
            type: String,
            required: false,
        },
        country: {
            type: String,
            required: false,
        },
        employeeCode: {
            type: String,
            required: false,
        },
        employeeSignature: {
            image: Buffer,
            contentType: {
                type: String,
                default: "image/png"
            }
        },
    },
    { timestamps: true }
)

const User = mongoose.models.User || mongoose.model("User", userSchema);
export default User;

import mongoose from "mongoose";

export const addressSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: {
        type: String,
        validate: {
            validator: function (v) {
                return !this.googleId || /^[6-9]\d{9}$/.test(v);
            },
            message: (props) => `${props.value} is not a valid phone number!`,
        },
    },
    addressLine1: { type: String, required: true },
    addressLine2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, default: "India" },
}, {
    timestamps: true
});

export const Address = mongoose.model("Address", addressSchema);
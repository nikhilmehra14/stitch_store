import mongoose from "mongoose";

const wishlistItemSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
});

const wishlistSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        items: [wishlistItemSchema],
    },
    {
        timestamps: true
    }
);

export const Wishlist = mongoose.model("Wishlist", wishlistSchema);
import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    price: {
        type: Number,
        required: true
    },
    name: {
        type: String,
        required: true
    },
});

const cartSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        items: [cartItemSchema],
        totalPrice: {
            type: Number,
            default: 0
        },
    },
    {
        timestamps: true
    }
);

cartSchema.methods.calculateTotal = function () {
    this.totalPrice = this.items.reduce((total, item) => total + (item.price * item.quantity), 0);
};

const Cart = mongoose.model("Cart", cartSchema);
export default Cart;

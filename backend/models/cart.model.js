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
    discountedPrice: {
        type: Number
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
        discountedTotal: {  // New field for coupon-adjusted total
            type: Number,
            default: 0
        },
        appliedCoupons: [{
            couponId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Coupon'
            },
            code: String,
            discountValue: Number,
            discountType: {
                type: String,
                enum: ['percentage', 'fixed']
            },
            appliedAt: {
                type: Date,
                default: Date.now
            }
        }]
    },
    {
        timestamps: true
    }
);

cartSchema.methods.calculateTotals = function() {
    const originalTotal = this.items.reduce(
        (total, item) => total + (item.price * item.quantity), 
        0
    );

    let discountedTotal = originalTotal;
    
    this.appliedCoupons.forEach(coupon => {
        if (coupon.discountType === 'percentage') {
            discountedTotal -= discountedTotal * (coupon.discountValue / 100);
        } else {
            discountedTotal = Math.max(
                discountedTotal - coupon.discountValue, 
                0
            );
        }
    });

    this.totalPrice = originalTotal;
    this.discountedTotal = discountedTotal;
};

const Cart = mongoose.model("Cart", cartSchema);
export default Cart;

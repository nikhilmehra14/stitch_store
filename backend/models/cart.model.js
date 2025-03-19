import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  price: {
    type: Number,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
});

const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [cartItemSchema],
    totalPrice: {
      type: Number,
      default: 0,
    },
    discountedTotal: {
      type: Number,
      default: 0,
    },
    shippingFee: {
      type: Number,
      default: 0,
    },
    appliedCoupons: [
      {
        couponId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Coupon",
          required: true,
        },
        code: {
          type: String,
          required: true,
        },
        discountPercentage: {
          type: Number,
          required: true,
          min: 0,
          max: 100,
        },
        maxDiscount: {
          type: Number,
          required: true,
          min: 0,
        },
        appliedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

cartSchema.methods.calculateTotals = function () {
  this.totalPrice = this.items.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  let discountedTotal = this.totalPrice;

  this.appliedCoupons.forEach((coupon) => {
    const discountAmount = Math.min(
      discountedTotal * (coupon.discountPercentage / 100),
      coupon.maxDiscount
    );
    discountedTotal -= discountAmount;
  });

  discountedTotal = Math.max(discountedTotal, 0);

  this.discountedTotal = Math.round(discountedTotal * 100) / 100;

  if (this.discountedTotal < 800) this.shippingFee = 55;
  else this.shippingFee = 0;
};

const Cart = mongoose.model("Cart", cartSchema);
export default Cart;

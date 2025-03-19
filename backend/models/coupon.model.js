import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true
    },
    discountPercentage: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    maxDiscount: {
        type: Number,
        required: true
    },
    minCartValue: {
        type: Number,
        default: 0
    },
    validFrom: {
        type: Date,
        required: true
    },
    validUntil: {
        type: Date,
        required: true
    },
    usageLimit: {
        type: Number,
        default: 1,
        min: 1,
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

couponSchema.pre('save', function (next) {
    const currentDate = new Date();
    this.isActive = (
        this.validFrom <= currentDate &&
        this.validUntil >= currentDate
    );
    next();
});

const Coupon = mongoose.model("Coupon", couponSchema);
export default Coupon;

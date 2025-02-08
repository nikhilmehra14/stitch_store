import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema({
    code: { 
        type: String, 
        required: true, 
        unique: true,
        uppercase: true
    },
    discountType: {
        type: String,
        enum: ['percentage'],
        required: true,
    },
    discountValue: {
        type: Number,
        required: true,
        min: 0,
    },
    productIds: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Product' 
    }],
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
    timesUsed: {
        type: Number,
        default: 0,
    },
}, { timestamps: true });

couponSchema.methods.isValid = function () {
    const currentDate = new Date();
    if (this.validFrom > currentDate || this.validUntil < currentDate) {
        return false;
    }
    if (this.timesUsed >= this.usageLimit) {
        return false;
    }
    return true;
};

const Coupon = mongoose.model("Coupon", couponSchema);
export default Coupon;
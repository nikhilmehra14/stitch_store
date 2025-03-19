import Coupon from "../models/coupon.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { HttpStatus } from "../constants/status.code.js";
import mongoose from "mongoose";
import { Product } from "../models/product.model.js";
import Cart from "../models/cart.model.js";

export const createCoupon = async (req, res) => {
    const {
        code,
        discountPercentage,
        maxDiscount,
        minCartValue,
        validFrom,
        validUntil,
        usageLimit
    } = req.body;

    if (!code || !discountPercentage || !maxDiscount || !validFrom || !validUntil) {
        return res.status(HttpStatus.BAD_REQUEST.code)
            .json(new ApiError(HttpStatus.BAD_REQUEST.code, "Required fields: code, discountPercentage, maxDiscount, validFrom, validUntil"));
    }

    if (new Date(validFrom) >= new Date(validUntil)) {
        return res.status(HttpStatus.BAD_REQUEST.code)
            .json(new ApiError(HttpStatus.BAD_REQUEST.code, "Valid Until must be later than Valid From"));
    }

    try {
        const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
        if (existingCoupon) {
            return res.status(HttpStatus.BAD_REQUEST.code)
                .json(new ApiError(HttpStatus.BAD_REQUEST.code, "Coupon code already exists"));
        }

        const coupon = new Coupon({
            code: code.toUpperCase(),
            discountPercentage,
            maxDiscount,
            minCartValue: minCartValue || 0,
            validFrom,
            validUntil,
            usageLimit: usageLimit || 1
        });

        await coupon.save();

        return res.status(HttpStatus.CREATED.code)
            .json(new ApiResponse(HttpStatus.CREATED.code, coupon, "Coupon created successfully"));
    } catch (error) {
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR.code)
            .json(new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, error.message));
    }
};

export const removeCoupon = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { couponCode } = req.body;
        const userId = req.user.id;

        if (!couponCode?.trim()) {
            await session.abortTransaction();
            return res.status(HttpStatus.BAD_REQUEST.code)
                .json(new ApiError(HttpStatus.BAD_REQUEST.code, "Coupon code is required"));
        }

        const cart = await Cart.findOne({ userId }).session(session);
        if (!cart) {
            await session.abortTransaction();
            return res.status(HttpStatus.NOT_FOUND.code)
                .json(new ApiError(HttpStatus.NOT_FOUND.code, "Cart not found"));
        }

        const couponIndex = cart.appliedCoupons.findIndex(c => c.code === couponCode.toUpperCase());
        if (couponIndex === -1) {
            await session.abortTransaction();
            return res.status(HttpStatus.BAD_REQUEST.code)
                .json(new ApiError(HttpStatus.BAD_REQUEST.code, "Coupon not found in cart"));
        }

        cart.appliedCoupons.splice(couponIndex, 1);

        cart.calculateTotals();

        await cart.save({ session });
        await session.commitTransaction();

        const cartData = {
            _id: cart._id,
            userId: cart.userId,
            totalPrice: Math.round(cart.totalPrice * 100) / 100,
            discountedTotal: Math.round(cart.discountedTotal * 100) / 100,
            shippingFee: cart.shippingFee,
            appliedCoupons: cart.appliedCoupons.map(c => ({
                code: c.code,
                discountPercentage: c.discountPercentage,
                maxDiscount: c.maxDiscount,
                appliedAt: c.appliedAt
            })),
            items: cart.items.map(item => ({
                cartItemId: item._id,
                productId: {
                    _id: item.productId._id,
                    productName: item.productId.product_name,
                    price: item.productId.price,
                    images: item.productId.images
                },
                quantity: item.quantity,
                price: item.price
            })),
            createdAt: cart.createdAt,
            updatedAt: cart.updatedAt
        };

        return res.status(HttpStatus.OK.code)
            .json(new ApiResponse(HttpStatus.OK.code, cartData, "Coupon removed successfully"));
    } catch (error) {
        await session.abortTransaction();
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR.code)
            .json(new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, error.message));
    } finally {
        session.endSession();
    }
};

export const clearAppliedCoupons = async (userId, session) => {
  try {
    const cart = await Cart.findOne({ userId }).session(session);
    if (!cart) {
      return { success: false, message: "Cart not found" };
    }

    cart.appliedCoupons = [];
    cart.discountedTotal = 0;
    cart.totalPrice = cart.items.reduce(
      (total, item) => total + item.price * item.quantity,
      0
    );

    await cart.save({ session });

    return { success: true, message: "Coupons cleared successfully" };
  } catch (error) {
    return {
      success: false,
      message: "Error clearing coupons",
      error: error.message,
    };
  }
};

export const getCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find();
        return res.status(HttpStatus.OK.code).json(
            new ApiResponse(HttpStatus.OK.code, coupons, "All coupons fetched successfully")
        );
    } catch (error) {
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(
            new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error fetching coupons")
        );
    }
};

export const getCouponsById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(HttpStatus.BAD_REQUEST.code).json(
                new ApiError(HttpStatus.BAD_REQUEST.code, "Invalid coupon ID format")
            );
        }

        const coupon = await Coupon.findById(id);

        if (!coupon) {
            return res.status(HttpStatus.NOT_FOUND.code).json(
                new ApiError(HttpStatus.NOT_FOUND.code, "Coupon not found")
            );
        }

        return res.status(HttpStatus.OK.code).json(
            new ApiResponse(HttpStatus.OK.code, coupon, "Coupon details fetched successfully")
        );
    } catch (error) {
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(
            new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error fetching coupon details")
        );
    }
};

export const deleteCoupon = async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(HttpStatus.BAD_REQUEST.code).json(
            new ApiError(HttpStatus.BAD_REQUEST.code, "Invalid coupon ID")
        );
    }

    try {
        const coupon = await Coupon.findOneAndDelete({ _id: id });

        if (!coupon) {
            return res.status(HttpStatus.NOT_FOUND.code).json(new ApiError(HttpStatus.NOT_FOUND.code, "Coupon not found"));
        }

        return res.status(HttpStatus.OK.code).json(new ApiResponse(HttpStatus.OK.code, {}, "Coupon deleted successfully"));
    } catch (error) {
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error deleting coupon"));
    }
};


export const editCoupon = async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(HttpStatus.BAD_REQUEST.code)
            .json(new ApiError(HttpStatus.BAD_REQUEST.code, "Invalid coupon ID"));
    }

    try {
        const coupon = await Coupon.findById(id);
        if (!coupon) {
            return res.status(HttpStatus.NOT_FOUND.code)
                .json(new ApiError(HttpStatus.NOT_FOUND.code, "Coupon not found"));
        }

        if (updates.code) {
            const existingCoupon = await Coupon.findOne({ code: updates.code.toUpperCase() });
            if (existingCoupon && existingCoupon._id.toString() !== id) {
                return res.status(HttpStatus.BAD_REQUEST.code)
                    .json(new ApiError(HttpStatus.BAD_REQUEST.code, "Coupon code already exists"));
            }
            coupon.code = updates.code.toUpperCase();
        }

        if (updates.discountPercentage !== undefined) {
            if (updates.discountPercentage < 0 || updates.discountPercentage > 100) {
                return res.status(HttpStatus.BAD_REQUEST.code)
                    .json(new ApiError(HttpStatus.BAD_REQUEST.code, "Discount percentage must be between 0-100"));
            }
            coupon.discountPercentage = updates.discountPercentage;
        }

        if (updates.maxDiscount !== undefined) {
            if (updates.maxDiscount < 0) {
                return res.status(HttpStatus.BAD_REQUEST.code)
                    .json(new ApiError(HttpStatus.BAD_REQUEST.code, "Max discount cannot be negative"));
            }
            coupon.maxDiscount = updates.maxDiscount;
        }

        if (updates.validFrom || updates.validUntil) {
            const newFrom = updates.validFrom ? new Date(updates.validFrom) : coupon.validFrom;
            const newUntil = updates.validUntil ? new Date(updates.validUntil) : coupon.validUntil;

            if (newFrom >= newUntil) {
                return res.status(HttpStatus.BAD_REQUEST.code)
                    .json(new ApiError(HttpStatus.BAD_REQUEST.code, "Valid Until must be later than Valid From"));
            }

            coupon.validFrom = newFrom;
            coupon.validUntil = newUntil;
        }

        const allowedUpdates = [
            'minCartValue', 'usageLimit'
        ];

        allowedUpdates.forEach(field => {
            if (updates[field] !== undefined) {
                if (field === 'minCartValue' && updates[field] < 0) {
                    return res.status(HttpStatus.BAD_REQUEST.code)
                        .json(new ApiError(HttpStatus.BAD_REQUEST.code, "Minimum cart value cannot be negative"));
                }
                if (field === 'usageLimit' && updates[field] < 1) {
                    return res.status(HttpStatus.BAD_REQUEST.code)
                        .json(new ApiError(HttpStatus.BAD_REQUEST.code, "Usage limit must be at least 1"));
                }
                coupon[field] = updates[field];
            }
        });

        const now = new Date();
        coupon.isActive = (
            coupon.validFrom <= now &&
            coupon.validUntil >= now
        );

        await coupon.save();
        return res.status(HttpStatus.OK.code)
            .json(new ApiResponse(HttpStatus.OK.code, coupon, "Coupon updated successfully"));

    } catch (error) {
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR.code)
            .json(new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error updating coupon: " + error.message));
    }
};


export const verifyCoupon = async (req, res) => {
    const { couponCode } = req.query;
    const userId = req.user._id;

    if (!couponCode) {
        return res.status(HttpStatus.BAD_REQUEST.code)
            .json(new ApiError(HttpStatus.BAD_REQUEST.code, "Coupon code is required"));
    }

    try {
        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(HttpStatus.NOT_FOUND.code)
                .json(new ApiError(HttpStatus.NOT_FOUND.code, "Cart not found"));
        }

        const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });
        if (!coupon) {
            return res.status(HttpStatus.NOT_FOUND.code)
                .json(new ApiError(HttpStatus.NOT_FOUND.code, "Coupon not found"));
        }

        const now = new Date();
        const isValid = (
            coupon.isActive &&
            coupon.validFrom <= now &&
            coupon.validUntil >= now
        );

        if (!isValid) {
            return res.status(HttpStatus.BAD_REQUEST.code)
                .json(new ApiError(HttpStatus.BAD_REQUEST.code, "Coupon is not currently valid"));
        }

        const totalCouponUsage = await Cart.countDocuments({
            "appliedCoupons.code": coupon.code
        });

        if (totalCouponUsage >= coupon.usageLimit) {
            return res.status(HttpStatus.BAD_REQUEST.code)
                .json(new ApiError(HttpStatus.BAD_REQUEST.code, "Coupon usage limit reached"));
        }

        if (cart.totalPrice < coupon.minCartValue) {
            return res.status(HttpStatus.BAD_REQUEST.code)
                .json(new ApiError(HttpStatus.BAD_REQUEST.code,
                    `Minimum cart value of ₹${coupon.minCartValue} required`));
        }

        const isApplied = cart.appliedCoupons.some(c => c.code === coupon.code);
        if (isApplied) {
            return res.status(HttpStatus.BAD_REQUEST.code)
                .json(new ApiError(HttpStatus.BAD_REQUEST.code, "Coupon already applied to cart"));
        }

        return res.status(HttpStatus.OK.code)
            .json(new ApiResponse(HttpStatus.OK.code, {
                code: coupon.code,
                discountPercentage: coupon.discountPercentage,
                maxDiscount: coupon.maxDiscount,
                minCartValue: coupon.minCartValue
            }, "Coupon is valid"));

    } catch (error) {
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR.code)
            .json(new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error verifying coupon"));
    }
};

export const applyCoupon = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { couponCode } = req.body;
        const userId = req.user.id;

        if (!couponCode?.trim()) {
            await session.abortTransaction();
            return res.status(HttpStatus.BAD_REQUEST.code)
                .json(new ApiError(HttpStatus.BAD_REQUEST.code, "Coupon code is required"));
        }

        const cart = await Cart.findOne({ userId }).session(session);
        if (!cart) {
            await session.abortTransaction();
            return res.status(HttpStatus.NOT_FOUND.code)
                .json(new ApiError(HttpStatus.NOT_FOUND.code, "Cart not found"));
        }

        const now = new Date();
        const validCoupons = await Promise.all(
            cart.appliedCoupons.map(async (couponInCart) => {
                const couponRecord = await Coupon.findOne({ code: couponInCart.code }).session(session);
                return couponRecord?.isActive &&
                    couponRecord.validFrom <= now &&
                    couponRecord.validUntil >= now
                    ? couponInCart
                    : null;
            })
        );
        cart.appliedCoupons = validCoupons.filter(coupon => coupon !== null);

        if (cart.appliedCoupons.length >= 1) {
            await session.abortTransaction();
            return res.status(HttpStatus.BAD_REQUEST.code)
                .json(new ApiError(HttpStatus.BAD_REQUEST.code, "A coupon is already applied. Remove it before applying another."));
        }

        const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() }).session(session);
        if (!coupon) {
            await session.abortTransaction();
            return res.status(HttpStatus.BAD_REQUEST.code)
                .json(new ApiError(HttpStatus.BAD_REQUEST.code, "Invalid coupon code"));
        }

        if (!coupon.isActive || coupon.validFrom > now || coupon.validUntil < now) {
            await session.abortTransaction();
            return res.status(HttpStatus.BAD_REQUEST.code)
                .json(new ApiError(HttpStatus.BAD_REQUEST.code, "Coupon is expired"));
        }

        const totalCouponUsage = await Cart.countDocuments({
            "appliedCoupons.code": coupon.code
        }).session(session);
	
        if (totalCouponUsage >= coupon.usageLimit) {
            await session.abortTransaction();
            return res.status(HttpStatus.BAD_REQUEST.code)
                .json(new ApiError(HttpStatus.BAD_REQUEST.code, "Coupon usage limit reached"));
        }
	console.log("Total Coupon Usage: ", totalCouponUsage);
	console.log("coupon usage limit: ", coupon.usageLimit);
        if (cart.totalPrice < coupon.minCartValue) {
            await session.abortTransaction();
            return res.status(HttpStatus.BAD_REQUEST.code)
                .json(new ApiError(HttpStatus.BAD_REQUEST.code,
                    `Minimum cart value of ₹${coupon.minCartValue} required`));
        }

        cart.appliedCoupons.push({
            couponId: coupon._id,
            code: coupon.code,
            discountPercentage: coupon.discountPercentage,
            maxDiscount: coupon.maxDiscount,
            appliedAt: new Date()
        });

        cart.calculateTotals();

        if (isNaN(cart.discountedTotal)) {
            throw new Error("Invalid discount calculation");
        }

        await cart.save({ session });
        await session.commitTransaction();

        const cartData = {
            _id: cart._id,
            userId: cart.userId,
            totalPrice: Math.round(cart.totalPrice * 100) / 100,
            discountedTotal: Math.round(cart.discountedTotal * 100) / 100,
            shippingFee: cart.shippingFee,
            appliedCoupons: cart.appliedCoupons.map(c => ({
                code: c.code,
                discountPercentage: c.discountPercentage,
                maxDiscount: c.maxDiscount,
                appliedAt: c.appliedAt
            })),
            items: cart.items.map(item => ({
                cartItemId: item._id,
                productId: {
                    _id: item.productId._id,
                    productName: item.productId.product_name,
                    price: item.productId.price,
                    images: item.productId.images
                },
                quantity: item.quantity,
                price: item.price
            })),
            createdAt: cart.createdAt,
            updatedAt: cart.updatedAt
        };
        
        return res.status(HttpStatus.OK.code)
            .json(new ApiResponse(HttpStatus.OK.code, cartData, "Coupon applied successfully"));
    } catch (error) {
        await session.abortTransaction();
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR.code)
            .json(new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, error.message));
    } finally {
        session.endSession();
    }
};

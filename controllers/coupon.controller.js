import Coupon from "../models/coupon.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { HttpStatus } from "../constants/status.code.js";
import mongoose from "mongoose";
import { Product } from "../models/product.model.js";
import Cart from "../models/cart.model.js";

export const createCoupon = async (req, res) => {
    const { code, discountType, discountValue, productIds, validFrom, validUntil, usageLimit } = req.body;

    if (!code || !discountType || !discountValue || !validFrom || !validUntil || !usageLimit) {
        return res.status(HttpStatus.BAD_REQUEST.code).json(new ApiError(HttpStatus.BAD_REQUEST.code, "All fields are required"));
    }

    if (new Date(validFrom) >= new Date(validUntil)) {
        return res.status(HttpStatus.BAD_REQUEST.code).json(new ApiError(HttpStatus.BAD_REQUEST.code, "Valid Until must be later than Valid From"));
    }

    try {
        const existingCoupon = await Coupon.findOne({ code });
        if (existingCoupon) {
            return res.status(HttpStatus.BAD_REQUEST.code).json(new ApiError(HttpStatus.BAD_REQUEST.code, "Coupon code already exists"));
        }

        const coupon = new Coupon({
            code,
            discountType,
            discountValue,
            productIds,
            validFrom,
            validUntil,
            usageLimit
        });

        await coupon.save();

        return res.status(HttpStatus.CREATED.code).json(new ApiResponse(HttpStatus.CREATED.code, coupon, "Coupon created successfully"));
    } catch (error) {
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, error.message));
    }
};

export const getCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find().populate({ path: "productIds", select: "product_name" });;
        return res.status(HttpStatus.OK.code).json(new ApiResponse(HttpStatus.OK.code, coupons, "Coupons fetched successfully"));
    } catch (error) {
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error fetching coupons"));
    }
};

export const getCouponsById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(HttpStatus.BAD_REQUEST.code).json(
                new ApiError(HttpStatus.BAD_REQUEST.code, "Invalid coupon ID")
            );
        }

        const coupon = await Coupon.findById(id).populate({ path: "productIds", select: "product_name" });

        if (!coupon) {
            return res.status(HttpStatus.NOT_FOUND.code).json(
                new ApiError(HttpStatus.NOT_FOUND.code, "Coupon not found")
            );
        }

        return res.status(HttpStatus.OK.code).json(
            new ApiResponse(HttpStatus.OK.code, coupon, "Coupon fetched successfully")
        );
    } catch (error) {
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(
            new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error fetching coupon by ID")
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
        const coupon = await Coupon.findOneAndDelete(id);

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
    const { code, discountValue, validFrom, validUntil, usageLimit, productIds } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(HttpStatus.BAD_REQUEST.code).json(
            new ApiError(HttpStatus.BAD_REQUEST.code, "Invalid coupon ID")
        );
    }

    try {
        const coupon = await Coupon.findById(id);

        if (!coupon) {
            return res.status(HttpStatus.NOT_FOUND.code).json(
                new ApiError(HttpStatus.NOT_FOUND.code, "Coupon not found")
            );
        }

        if (code) {
            const existingCoupon = await Coupon.findOne({ code });
            if (existingCoupon && existingCoupon._id.toString() !== id) {
                return res.status(HttpStatus.BAD_REQUEST.code).json(
                    new ApiError(HttpStatus.BAD_REQUEST.code, "Coupon code already exists")
                );
            }
            coupon.code = code;
        }

        if (validFrom && validUntil) {
            if (new Date(validFrom) >= new Date(validUntil)) {
                return res.status(HttpStatus.BAD_REQUEST.code).json(new ApiError(HttpStatus.BAD_REQUEST.code, "Valid Until must be later than Valid From"));
            }
            coupon.validFrom = validFrom;
            coupon.validUntil = validUntil;
        }

        if (discountValue !== undefined) coupon.discountValue = discountValue;
        if (usageLimit !== undefined) coupon.usageLimit = usageLimit;
        if (productIds !== undefined) coupon.productIds = productIds;

        await coupon.save();

        return res.status(HttpStatus.OK.code).json(
            new ApiResponse(HttpStatus.OK.code, coupon, "Coupon updated successfully")
        );
    } catch (error) {
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(
            new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error updating coupon")
        );
    }
};


export const verifyCoupon = async (req, res) => {
    const { couponCode, productId } = req.query;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(HttpStatus.BAD_REQUEST.code).json(
            new ApiError(HttpStatus.BAD_REQUEST.code, "Invalid coupon ID")
        );
    }

    if (!couponCode || !productId) {
        return res.status(HttpStatus.BAD_REQUEST.code).json(new ApiError(HttpStatus.BAD_REQUEST.code, "Coupon code and product ID are required"));
    }

    try {
        const coupon = await Coupon.findOne({ code: couponCode });

        if (!coupon) {
            return res.status(HttpStatus.NOT_FOUND.code).json(new ApiError(HttpStatus.NOT_FOUND.code, "Coupon not found"));
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(HttpStatus.NOT_FOUND.code).json(new ApiError(HttpStatus.NOT_FOUND.code, "Product not found"));
        }

        if (!coupon.productIds.some(id => id.toString() === product._id.toString())) {
            return res.status(HttpStatus.BAD_REQUEST.code).json(new ApiError(HttpStatus.BAD_REQUEST.code, "Coupon is not applicable to this product"));
        }

        const currentDate = new Date();
        if (currentDate < new Date(coupon.validFrom) || currentDate > new Date(coupon.validUntil)) {
            return res.status(HttpStatus.BAD_REQUEST.code).json(new ApiError(HttpStatus.BAD_REQUEST.code, "Coupon is not valid in the current date range"));
        }

        return res.status(HttpStatus.OK.code).json(new ApiResponse(HttpStatus.OK.code, {}, "Coupon verified successfully"));
    } catch (error) {
        console.error("Error verifying coupon:", error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error verifying coupon", error.message));
    }
};


export const applyCoupon = async (req, res) => {
    const { couponCode } = req.body;
    const userId = req.user._id;
  
    if (!couponCode) {
      return res.status(HttpStatus.BAD_REQUEST.code).json(new ApiError(HttpStatus.BAD_REQUEST.code, "Coupon code is required"));
    }
  
    try {
      const cart = await Cart.findOne({ userId }).populate("items.productId");
      if (!cart) {
        return res.status(HttpStatus.NOT_FOUND.code).json(new ApiError(HttpStatus.NOT_FOUND.code, "Cart not found"));
      }
  
      const coupon = await Coupon.findOne({ code: couponCode });
  
      if (!coupon) {
        return res.status(HttpStatus.BAD_REQUEST.code).json(new ApiError(HttpStatus.BAD_REQUEST.code, "Invalid coupon code"));
      }
  
      if (!coupon.isValid()) {
        return res.status(HttpStatus.BAD_REQUEST.code).json(new ApiError(HttpStatus.BAD_REQUEST.code, "Coupon is expired"));
      }
  
      const applicableItems = cart.items.filter(item =>
        coupon.productIds.includes(item.productId.toString())
      );
  
      if (applicableItems.length === 0) {
        return res.status(HttpStatus.BAD_REQUEST.code).json(new ApiError(HttpStatus.BAD_REQUEST.code, "Coupon is not applicable to the products in your cart"));
      }
  
      const discountAmount = applicableItems.reduce((total, item) => {
        total += (item.price * coupon.discountValue / 100) * item.quantity;
        return total;
      }, 0);
  
      cart.totalPrice -= discountAmount;
      await cart.save();
  
      coupon.timesUsed += 1;
      await coupon.save();
  
      return res.status(HttpStatus.OK.code).json(new ApiResponse(HttpStatus.OK.code, cart, "Coupon applied successfully"));
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, error.message));
    }
  };
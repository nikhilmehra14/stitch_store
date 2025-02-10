import mongoose from "mongoose";
import { HttpStatus } from "../constants/status.code.js";
import { Product } from "../models/product.model.js";
import { Wishlist } from "../models/wishlist.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { updateCart } from "./cart.controller.js";

export const addToWishlist = async (req, res) => {
    const { productId } = req.body;
    const userId = req.user?._id;

    try {
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(HttpStatus.NOT_FOUND.code).json(
                new ApiError(HttpStatus.NOT_FOUND.code, "Product not found")
            );
        }

        let wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            wishlist = new Wishlist({ userId, items: [] });
        }

        const itemIndex = wishlist.items.findIndex(item => item.productId.toString() === productId);

        if (itemIndex > -1) {
            return res.status(HttpStatus.BAD_REQUEST.code).json(
                new ApiError(HttpStatus.BAD_REQUEST.code, "Product already in wishlist")
            );
        }

        wishlist.items.push({
            productId,
            name: product.product_name,
            price: product.price,
        });

        await wishlist.save();

        return res.status(HttpStatus.OK.code).json(
            new ApiResponse(HttpStatus.OK.code, wishlist, "Product added to wishlist successfully")
        );
    } catch (error) {
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(
            new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error adding product to wishlist", error.message)
        );
    }
};

export const removeFromWishlist = async (req, res) => {
    const { productId } = req.body;
    const userId = req.user?._id;

    try {
        if(!mongoose.Types.ObjectId.isValid(productId)){
            return res.status(HttpStatus.BAD_REQUEST.code).json(new ApiError(HttpStatus.BAD_REQUEST.code, "Invalid Product Id"))
        }
        const wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            return res.status(HttpStatus.NOT_FOUND.code).json(
                new ApiError(HttpStatus.NOT_FOUND.code, "Wishlist not found")
            );
        }

        const productObjectId = new mongoose.Types.ObjectId(productId);

        const itemIndex = wishlist.items.findIndex(
            (item) => item.productId.toString() === productObjectId.toString()
        );

        if (itemIndex === -1) {
            return res.status(HttpStatus.NOT_FOUND.code).json(
                new ApiError(HttpStatus.NOT_FOUND.code, "Product not found in wishlist")
            );
        }

        wishlist.items.splice(itemIndex, 1);
        await wishlist.save();

        return res.status(HttpStatus.OK.code).json(
            new ApiResponse(HttpStatus.OK.code, wishlist, "Product removed from wishlist successfully")
        );
    } catch (error) {
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(
            new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error removing product from wishlist", error.message)
        );
    }
};


export const viewWishlist = async (req, res) => {
    const userId = req.user?._id;

    try {
        const wishlist = await Wishlist.findOne({ userId }).populate('items.productId');
        return res.status(HttpStatus.OK.code).json(
            new ApiResponse(HttpStatus.OK.code, wishlist, "Wishlist retrieved successfully")
        );
    } catch (error) {
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(
            new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error retrieving wishlist", error.message)
        );
    }
};

export const moveToCart = async (req, res) => {
    const { productId, quantity } = req.body;
    const userId = req.user?._id;

    try {
        const wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            return res.status(HttpStatus.NOT_FOUND.code).json(
                new ApiError(HttpStatus.NOT_FOUND.code, "Wishlist not found")
            );
        }

        const itemIndex = wishlist.items.findIndex(item => item.productId.toString() === productId);

        if (itemIndex === -1) {
            return res.status(HttpStatus.NOT_FOUND.code).json(
                new ApiError(HttpStatus.NOT_FOUND.code, "Product not found in wishlist")
            );
        }

        const cart = await updateCart(userId, productId, quantity);

        wishlist.items.splice(itemIndex, 1);
        await wishlist.save();

        return res.status(HttpStatus.OK.code).json(
            new ApiResponse(HttpStatus.OK.code, { cart, wishlist }, "Product moved to cart successfully")
        );
    } catch (error) {
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(
            new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error moving product to cart", error.message)
        );
    }
};

import Cart from "../models/cart.model.js";
import { Product } from "../models/product.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import { HttpStatus } from "../constants/status.code.js";
import Coupon from "../models/coupon.model.js";

export const updateCart = async (userId, productId, quantity) => {
  try {
    const product = await Product.findById(productId);

    if (!product) {
      throw new ApiError(HttpStatus.NOT_FOUND.code, "Product not found");
    }

    if (quantity > product.stock) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST.code,
        `Only ${product.stock} units available in stock.`
      );
    }

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId
    );

    if (itemIndex > -1) {
      cart.items[itemIndex].quantity += quantity;
      if (cart.items[itemIndex].quantity > product.stock) {
        throw new ApiError(
          HttpStatus.BAD_REQUEST.code,
          `Only ${product.stock} units available in stock.`
        );
      }
    } else {
      cart.items.push({
        productId,
        quantity,
        name: product.product_name,
        price: product.price,
      });
    }

    cart.calculateTotals();
    await cart.save();

    return cart;
  } catch (error) {
    throw error;
  }
};

export const addToCart = async (req, res) => {
  const { productId, quantity } = req.body;
  const userId = req.user?._id;

  try {
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(HttpStatus.NOT_FOUND.code).json(new ApiError(HttpStatus.NOT_FOUND.code, "Product not found"));
    }

    if (quantity > product.stock) {
      return res.status(HttpStatus.BAD_REQUEST.code).json(new ApiError(HttpStatus.BAD_REQUEST.code, `Only ${product.stock} units available.`));
    }

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({
        userId,
        items: [],
        appliedCoupons: [],
        totalPrice: 0,
        discountedTotal: 0,
        shippingFee: 0
      });
    }

    const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);

    if (itemIndex > -1) {
      cart.items[itemIndex].quantity = quantity;
      if (cart.items[itemIndex].quantity > product.stock) {
        return res.status(HttpStatus.BAD_REQUEST.code).json(new ApiError(HttpStatus.BAD_REQUEST.code, `Only ${product.stock} units available.`));
      }
    } else {
      cart.items.push({
        productId,
        quantity,
        name: product.product_name,
        price: product.price,
      });
    }

    cart.appliedCoupons = cart.appliedCoupons.filter(coupon =>
      coupon.couponId &&
      typeof coupon.discountPercentage === 'number' &&
      typeof coupon.maxDiscount === 'number'
    );


    cart.calculateTotals();

    if (isNaN(cart.discountedTotal)) {
      cart.discountedTotal = 0;
    }


    await cart.save();

    return res.status(HttpStatus.OK.code).json(new ApiResponse(HttpStatus.OK.code, cart, "Cart updated successfully"));
  } catch (error) {
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error updating cart", error.message));
  }
};


export const updateCartItemQuantity = async (req, res) => {
  const { productId, quantity } = req.body;
  const userId = req.user?._id;

  try {
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(HttpStatus.NOT_FOUND.code).json(new ApiError(HttpStatus.NOT_FOUND.code, "Product not found"));
    }

    if (quantity > product.stock) {
      return res.status(HttpStatus.BAD_REQUEST.code).json(new ApiError(HttpStatus.BAD_REQUEST.code, `Only ${product.stock} units available.`));
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(HttpStatus.NOT_FOUND.code).json(new ApiError(HttpStatus.NOT_FOUND.code, "Cart not found"));
    }

    const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
    if (itemIndex === -1) {
      return res.status(HttpStatus.NOT_FOUND.code).json(new ApiError(HttpStatus.NOT_FOUND.code, "Product not found in cart"));
    }

    cart.items[itemIndex].quantity = quantity;
    cart.calculateTotals();
    await cart.save();

    return res.status(HttpStatus.OK.code).json(new ApiResponse(HttpStatus.OK.code, cart, "Cart item quantity updated successfully"));
  } catch (error) {
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error updating cart item quantity", error.message));
  }
};

export const getCart = async (req, res) => {
  const userId = req.user?._id;

  try {
    let cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart) {
      return res.status(HttpStatus.NOT_FOUND.code)
        .json(new ApiError(HttpStatus.NOT_FOUND.code, "Cart not found"));
    }

    cart.items = cart.items.filter(item => item.productId !== null);

    const now = new Date();
    const validCoupons = await Promise.all(
      cart.appliedCoupons.map(async (coupon) => {
        const couponDoc = await Coupon.findById(coupon.couponId);
        return couponDoc?.isActive &&
          couponDoc.validFrom <= now &&
          couponDoc.validUntil >= now
          ? coupon
          : null;
      })
    );
    cart.appliedCoupons = validCoupons.filter(coupon => coupon !== null);

    cart.calculateTotals(); 
    await cart.save();

    const cartData = {
      _id: cart._id,
      totalPrice: cart.totalPrice,
      discountedTotal: cart.discountedTotal,
      shippingFee: cart.shippingFee,
      items: cart.items.map(item => ({
        productId: item.productId._id,
        productName: item.productId.product_name,
        quantity: item.quantity,
        price: item.price,
        totalItemPrice: item.quantity * item.price,
        images: item.productId.images,
      })),
      appliedCoupons: cart.appliedCoupons.map(coupon => ({
        code: coupon.code,
        discountPercentage: coupon.discountPercentage,
        maxDiscount: coupon.maxDiscount,
      })),
    };

    return res.status(HttpStatus.OK.code)
      .json(new ApiResponse(HttpStatus.OK.code, cartData, "Cart fetched successfully"));
  } catch (error) {
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR.code)
      .json(new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error fetching cart", error.message));
  }
};

export const clearCart = async (req, res) => {
  const userId = req.user?._id;

  try {
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(HttpStatus.NOT_FOUND.code).json(new ApiError(HttpStatus.NOT_FOUND.code, "Cart not found"));
    }

    cart.items = [];
    cart.discountedTotal = 0;
    cart.appliedCoupons = [];
    cart.totalPrice = 0;
    await cart.save();

    return res.status(HttpStatus.OK.code).json(new ApiResponse(HttpStatus.OK.code, cart, "Cart cleared successfully"));
  } catch (error) {
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error clearing cart", error.message));
  }
};

export const deleteCartItem = async (req, res) => {
  const productId = req.params?.id;
  const userId = req.user?._id;

  try {
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(HttpStatus.NOT_FOUND.code).json(new ApiError(HttpStatus.NOT_FOUND.code, "Cart not found"));
    }

    const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
    if (itemIndex === -1) {
      return res.status(HttpStatus.NOT_FOUND.code).json(new ApiError(HttpStatus.NOT_FOUND.code, "Product not found in cart"));
    }

    cart.items.splice(itemIndex, 1);
    cart.calculateTotals();
    await cart.save();

    return res.status(HttpStatus.OK.code).json(new ApiResponse(HttpStatus.OK.code, cart, "Cart item deleted successfully"));
  } catch (error) {
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error deleting cart item", error.message));
  }
};

import Cart from "../models/cart.model.js";
import { Product } from "../models/product.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import { HttpStatus } from "../constants/status.code.js";

export const addToCart = async (req, res) => {
  const { productId, quantity } = req.body;
  const userId = req.user?._id;

  try {
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(HttpStatus.NOT_FOUND.code).json(
        new ApiError(HttpStatus.NOT_FOUND.code, "Product not found")
      );
    }

    if (quantity > product.stock) {
      return res.status(HttpStatus.BAD_REQUEST.code).json(new ApiError(HttpStatus.BAD_REQUEST.code, `Only ${product.stock} units available in stock.`));
    }

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);

    if (itemIndex > -1) {
      const newQuantity = cart.items[itemIndex].quantity + quantity;
      if (product.stock < newQuantity) {
        return res.status(HttpStatus.BAD_REQUEST.code).json(
          new ApiError(HttpStatus.BAD_REQUEST.code, `Only ${product.stock} units available in stock.`)
        );
      }
      cart.items[itemIndex].quantity = newQuantity;
    } else {
      cart.items.push({
        productId,
        quantity,
        name: product.product_name,
        price: product.price,
      });

    }

    await cart.save();

    return res.status(HttpStatus.OK.code).json(
      new ApiResponse(HttpStatus.OK.code, cart, "Product added to cart successfully")
    );
  } catch (error) {
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(
      new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error adding product to cart", error.message)
    );
  }
};

export const updateCartItemQuantity = async (req, res) => {
  const { productId, quantity } = req.body;
  const userId = req.user?._id;

  try {
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(HttpStatus.NOT_FOUND.code).json(
        new ApiError(HttpStatus.NOT_FOUND.code, "Product not found")
      );
    }

    if (product.stock < quantity) {
      return res.status(HttpStatus.BAD_REQUEST.code).json(
        new ApiError(HttpStatus.BAD_REQUEST.code, `Only ${product.stock} units available in stock.`)
      );
    }

    const cart = await Cart.findOne({ userId });

    if (!cart) {
      return res.status(HttpStatus.NOT_FOUND.code).json(
        new ApiError(HttpStatus.NOT_FOUND.code, "Cart not found")
      );
    }

    const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);

    if (itemIndex > -1) {
      cart.items[itemIndex].quantity = quantity;
    } else {
      return res.status(HttpStatus.NOT_FOUND.code).json(
        new ApiError(HttpStatus.NOT_FOUND.code, "Product not found in cart")
      );
    }

    await cart.save();

    return res.status(HttpStatus.OK.code).json(
      new ApiResponse(HttpStatus.OK.code, cart, "Cart item quantity updated successfully")
    );
  } catch (error) {
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(
      new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error updating cart item quantity")
    );
  }
};

export const getCart = async (req, res) => {
  const userId = req.user?._id;

  try {
    const cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart) {
      return res.status(HttpStatus.NOT_FOUND.code).json(
        new ApiError(HttpStatus.NOT_FOUND.code, "Cart not found")
      );
    }

    const cartData = {
      _id: cart._id,
      totalPrice: cart.totalPrice,
      items: cart.items.map(item => ({
        productId: item.productId._id,
        productName: item.productId.product_name,
        quantity: item.quantity,
        price: item.price,
        totalItemPrice: item.quantity * item.price,
      }))
    };


    return res.status(HttpStatus.OK.code).json(
      new ApiResponse(HttpStatus.OK.code, cartData, "Cart fetched successfully")
    );
  } catch (error) {
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(
      new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error fetching cart")
    );
  }
};


export const clearCart = async (req, res) => {
  const userId = req.user?._id;

  try {
    const cart = await Cart.findOne({ userId });

    if (!cart) {
      return res.status(HttpStatus.NOT_FOUND.code).json(
        new ApiError(HttpStatus.NOT_FOUND.code, "Cart not found")
      );
    }

    cart.items = [];
    cart.totalPrice = 0;
    await cart.save();

    return res.status(HttpStatus.OK.code).json(
      new ApiResponse(HttpStatus.OK.code, cart, "Cart cleared successfully")
    );
  } catch (error) {
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(
      new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error clearing cart")
    );
  }
};

export const deleteCartItem = async (req, res) => {
  const  productId = req.params?.id; 
  const userId = req.user?._id;

  try {
    const cart = await Cart.findOne({ userId });

    if (!cart) {
      return res.status(HttpStatus.NOT_FOUND.code).json(
        new ApiError(HttpStatus.NOT_FOUND.code, "Cart not found")
      );
    }

    const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);

    if (itemIndex === -1) {
      return res.status(HttpStatus.NOT_FOUND.code).json(
        new ApiError(HttpStatus.NOT_FOUND.code, "Product not found in cart")
      );
    }

    cart.items.splice(itemIndex, 1);

    await cart.save();

    return res.status(HttpStatus.OK.code).json(
      new ApiResponse(HttpStatus.OK.code, cart, "Cart item deleted successfully")
    );
  } catch (error) {
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(
      new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error deleting cart item", error.message)
    );
  }
}
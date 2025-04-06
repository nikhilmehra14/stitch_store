import { Order } from "../models/order.model.js";
import { Product } from "../models/product.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import { HttpStatus } from "../constants/status.code.js";
import Razorpay from "razorpay";
import {
  cancelShiprocketOrder,
  createShiprocketOrder,
  generateShippingLabel,
  trackShiprocketOrder,
} from "../services/shiprocket.service.js";
import mongoose from "mongoose";
import sendEmail from "../services/email.service.js";
import { verifyPayment } from "../services/payment.service.js";
import {
  sendAdminAlert,
  sendOrderConfirmationEmail,
  sendOrderShippedEmail,
} from "../utils/order.util.js";
import Cart from "../models/cart.model.js";
import Coupon from "../models/coupon.model.js";

const ORDER_STATUS = {
  PENDING_PAYMENT: "Pending",
  PAID: "Paid",
  SHIPPED: "Shipped",
};

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export const createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderItems, shippingAddress, paymentMethod } = req.body;
    const userId = req.user?._id;

    if (!orderItems || !Array.isArray(orderItems)) {
      await session.abortTransaction();
      return res
        .status(HttpStatus.BAD_REQUEST.code)
        .json(
          new ApiError(
            HttpStatus.BAD_REQUEST.code,
            "Invalid order items format"
          )
        );
    }

    if (!["razorpay", "upi"].includes(paymentMethod)) {
      return res
        .status(HttpStatus.BAD_REQUEST.code)
        .json(
          new ApiError(HttpStatus.BAD_REQUEST.code, "Invalid Payment Method")
        );
    }

    const cart = await Cart.findOne({ userId })
      .populate({ path: "items.productId", select: "price product_name sku" })
      .populate("shippingFee items appliedCoupons")
      .session(session);

    if (!cart || cart.items.length === 0) {
      await session.abortTransaction();
      return res
        .status(HttpStatus.BAD_REQUEST.code)
        .json(new ApiError(HttpStatus.BAD_REQUEST.code, "Cart is empty"));
    }

    const cartItemsMap = new Map(
      cart.items.map((item) => [item.productId._id.toString(), item])
    );
    const validatedOrderItems = [];
    let totalAmount = 0;

    for (const selectedItem of orderItems) {
      const cartItem = cartItemsMap.get(selectedItem.product);

      if (!cartItem) {
        await session.abortTransaction();
        return res
          .status(HttpStatus.BAD_REQUEST.code)
          .json(
            new ApiError(
              HttpStatus.BAD_REQUEST.code,
              `Product ${selectedItem.product} not found in cart`
            )
          );
      }

      if (selectedItem.quantity > cartItem.quantity) {
        await session.abortTransaction();
        return res
          .status(HttpStatus.BAD_REQUEST.code)
          .json(
            new ApiError(
              HttpStatus.BAD_REQUEST.code,
              `Invalid quantity for ${cartItem.productId.product_name}`
            )
          );
      }

      const product = cartItem.productId;
      if (cartItem.price !== product.price) {
        await session.abortTransaction();
        return res
          .status(HttpStatus.BAD_REQUEST.code)
          .json(
            new ApiError(
              HttpStatus.BAD_REQUEST.code,
              `Price changed for ${product.product_name} - refresh cart`
            )
          );
      }

      validatedOrderItems.push({
        product: product._id,
        quantity: selectedItem.quantity,
        price: cartItem.discountedPrice || product.price,
        product_name: product.product_name,
        sku: product.sku,
      });

      const finalPrice = cartItem.discountedPrice || product.price;
      totalAmount += finalPrice * selectedItem.quantity;
    }

    const shippingFee = cart.shippingFee || 0;
    totalAmount += shippingFee;

    let couponDiscount = 0;
    if (cart.appliedCoupons && cart.appliedCoupons.length === 1) {
      const coupon = cart.appliedCoupons[0];
      if (coupon.discountPercentage > 0) {
        const discountAmount = (totalAmount * coupon.discountPercentage) / 100;
        couponDiscount = Math.min(discountAmount, coupon.maxDiscount);
      }
    }

    totalAmount -= couponDiscount;

    if (totalAmount < 0) totalAmount = 0;

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(totalAmount * 100),
      currency: "INR",
      receipt: `order_rcptid_${Date.now()}`,
      notes: { user_id: userId.toString() },
    });

    const order = new Order({
      user: userId,
      orderItems: validatedOrderItems,
      totalAmount,
      shippingFee,
      shippingAddress,
      paymentMethod,
      razorpayOrderId: razorpayOrder.id,
      status: ORDER_STATUS.PENDING_PAYMENT,
      appliedCoupons: cart.appliedCoupons,
    });

    await order.save({ session });

    await session.commitTransaction();
    console.log("razorpay order: ", razorpayOrder);

    return res.status(HttpStatus.CREATED.code).json(
      new ApiResponse(
        HttpStatus.CREATED.code,
        {
          orderId: order?._id,
          razorpayOrderId: razorpayOrder?.id,
          amount: totalAmount,
          shippingFee,
          currency: "INR",
        },
        "Order created successfully, waiting for payment confirmation."
      )
    );
  } catch (error) {
    await session.abortTransaction();
    console.error("Order Creation Error:", error);

    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR.code)
      .json(new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, error.message));
  } finally {
    session.endSession();
  }
};

export const clearCart = async (userId, session) => {
  try {
    const cart = await Cart.findOne({ userId }).session(session);
    if (!cart) {
      return { success: false, message: "Cart not found" };
    }

    cart.items = [];
    cart.appliedCoupons = [];
    cart.discountedTotal = 0;
    cart.totalPrice = 0;
    await cart.save({ session });

    return { success: true, message: "Cart cleared successfully" };
  } catch (error) {
    return {
      success: false,
      message: "Error clearing cart",
      error: error.message,
    };
  }
};

export const confirmOrder = async (req, res) => {
  const { razorpayPaymentId, razorpayOrderId, razorpaySignature, orderId } =
    req.body;
  let order;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const verification = await verifyPayment(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );
    if (!verification.success) {
      await session.abortTransaction();
      return res
        .status(verification.error?.statusCode || 500)
        .json(
          new ApiError(
            verification.error?.statusCode ||
              HttpStatus.INTERNAL_SERVER_ERROR.code,
            "Payment verification failed"
          )
        );
    }

    order = await Order.findOne({ _id: orderId, razorpayOrderId }).session(
      session
    );
    if (!order || order.paymentStatus !== ORDER_STATUS.PENDING_PAYMENT) {
      await session.abortTransaction();
      return res
        .status(HttpStatus.BAD_REQUEST.code)
        .json(new ApiError(HttpStatus.BAD_REQUEST.code, "Invalid order"));
    }

    const cart = await Cart.findOne({ userId: order.user }).session(session);
    if (
      !cart ||
      !Array.isArray(cart.appliedCoupons) ||
      cart.appliedCoupons.length === 0
    ) {
      console.error("No applied coupons found for the cart");
    } else {
      for (const appliedCoupon of cart.appliedCoupons) {
        const now = new Date();

        const totalCouponUsage = await Cart.countDocuments({
          "appliedCoupons.code": appliedCoupon.code,
        }).session(session);

        const coupon = await Coupon.findById(appliedCoupon.couponId).session(
          session
        );
        if (
          coupon &&
          coupon.usageLimit &&
          totalCouponUsage >= coupon.usageLimit
        ) {
          await session.abortTransaction();
          return res
            .status(HttpStatus.BAD_REQUEST.code)
            .json(
              new ApiError(
                HttpStatus.BAD_REQUEST.code,
                `Coupon ${appliedCoupon.code} has exceeded its usage limit`
              )
            );
        }

        const updateResult = await Coupon.updateOne(
          {
            _id: appliedCoupon.couponId,
            validFrom: { $lte: now },
            validUntil: { $gte: now },
            isActive: true,
            $expr: { $lt: ["$timesUsed", "$usageLimit"] },
          },
          { $inc: { timesUsed: 1 } }
        ).session(session);

        if (updateResult.modifiedCount === 0) {
          await session.abortTransaction();
          return res
            .status(HttpStatus.BAD_REQUEST.code)
            .json(
              new ApiError(
                HttpStatus.BAD_REQUEST.code,
                `Coupon ${appliedCoupon.code} is invalid`
              )
            );
        }

        const updatedCoupon = await Coupon.findById(
          appliedCoupon.couponId
        ).session(session);
        if (updatedCoupon.timesUsed >= updatedCoupon.usageLimit) {
          updatedCoupon.isActive = false;
          await updatedCoupon.save({ session });
        }
      }
    }

    order.status = ORDER_STATUS.PAID;
    order.razorpayPaymentId = razorpayPaymentId;
    order.amountPaid = order.totalAmount;
    await order.save({ session });

    const clearCartResult = await clearCart(order.user, session);
    if (!clearCartResult.success) {
      console.error("Failed to clear cart:", clearCartResult.message);
      await session.abortTransaction();
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR.code)
        .json(
          new ApiError(
            HttpStatus.INTERNAL_SERVER_ERROR.code,
            "Error clearing cart"
          )
        );
    }

    await session.commitTransaction();
    Promise.allSettled([
      sendOrderConfirmationEmail(order)
    ]).catch(err => console.error("Email Error:", err));

    const shiprocketPayload = {
      order_id: order._id.toString(),
      order_date: new Date().toISOString().split("T")[0],
      payment_method: "prepaid",
      order_items: order.orderItems.map((item) => ({
        product_id: item.product.toString(),
        quantity: item.quantity,
        price: item.price,
        product_name: item.product_name,
        sku: item.sku,
        units: item.quantity,
        selling_price: item.price,
        name: item.product_name,
      })),
      sub_total: order.totalAmount,
      shipping_is_billing: true,
      billing_customer_name: order.shippingAddress.name,
      billing_last_name: "",
      billing_address: order.shippingAddress.addressLine1,
      billing_state: order.shippingAddress.state,
      billing_country: order.shippingAddress.country,
      billing_phone: order.shippingAddress.phone,
      billing_pincode: order.shippingAddress.zipCode,
      length: 15,
      breadth: 5,
      height: 20, 
      weight: 0.8,
      pickup_location: "Home",
    };    

    console.log("shiprocket payload: ", shiprocketPayload);
    try {
      const shiprocketOrder = await createShiprocketOrder(shiprocketPayload);
      const shippingLabel = await generateShippingLabel(
        shiprocketOrder.shipment_id
      );

      order.shiprocketOrderId = shiprocketOrder.order_id;
      order.shippingLabel = shippingLabel.label_url;
      order.status = ORDER_STATUS.SHIPPED;
      await order.save();

      await sendOrderShippedEmail(order, shiprocketOrder.shipment_id);

      return res
        .status(HttpStatus.OK.code)
        .json(
          new ApiResponse(
            HttpStatus.OK.code,
            order,
            "Order confirmed & shipped"
          )
        );
    } catch (shippingError) {
      console.error("Shipping processing failed:", shippingError);
      await sendAdminAlert(order, shippingError);

      return res
        .status(HttpStatus.OK.code)
        .json(
          new ApiResponse(
            HttpStatus.OK.code,
            order,
            "Payment confirmed but shipping failed. Admin notified."
          )
        );
    }
  } catch (error) {
    await session.abortTransaction();
    console.error("Order confirmation failed:", error);
    await sendAdminAlert(order || { _id: orderId }, error);

    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR.code)
      .json(
        new ApiError(
          HttpStatus.INTERNAL_SERVER_ERROR.code,
          "Order processing failed",
          error.message
        )
      );
  } finally {
    session.endSession();
  }
};

export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.aggregate([
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "userInfo",
        },
      },
      {
        $unwind: "$userInfo",
      },
      {
        $unwind: "$orderItems",
      },
      {
        $lookup: {
          from: "products",
          localField: "orderItems.product",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      {
        $unwind: "$productDetails",
      },
      {
        $addFields: {
          "orderItems.totalPrice": {
            $multiply: ["$orderItems.price", "$orderItems.quantity"],
          },
        },
      },
      {
        $group: {
          _id: "$_id",
          user: { $first: "$userInfo" },
          shippingAddress: { $first: "$shippingAddress" },
          orderItems: {
            $push: {
              productId: "$orderItems.product",
              productName: "$productDetails.product_name",
              sku: "$productDetails.sku",
              category: "$productDetails.category",
              description: "$productDetails.description",
              price: "$orderItems.price",
              quantity: "$orderItems.quantity",
              totalPrice: "$orderItems.totalPrice",
              imageUrl: { $arrayElemAt: ["$productDetails.images", 0] },
            },
          },
          totalAmount: { $sum: "$orderItems.totalPrice" },
          paymentStatus: { $first: "$paymentStatus" },
          orderStatus: { $first: "$orderStatus" },
          paymentMethod: { $first: "$paymentMethod" },
          currency: { $first: "$currency" },
          createdAt: { $first: "$createdAt" },
          updatedAt: { $first: "$updatedAt" },
        },
      },
      {
        $addFields: {
          user: {
            userId: "$user._id",
            email: "$user.email",
            fullName: "$user.fullName",
          },
        },
      },
      {
        $sort: { createdAt: -1 },
      },
    ]);

    res
      .status(HttpStatus.OK.code)
      .json(
        new ApiResponse(
          HttpStatus.OK.code,
          orders,
          "Orders retrieved successfully"
        )
      );
  } catch (error) {
    res
      .status(HttpStatus.INTERNAL_SERVER_ERROR.code)
      .json(
        new ApiError(
          HttpStatus.INTERNAL_SERVER_ERROR.code,
          "Error while fetching orders",
          error.message
        )
      );
  }
};


export const getUserOrders = async (req, res) => {
  try {
    const userId = req.user._id;
    const orders = await Order.find({ user: userId }).populate(
      "orderItems.product"
    );

    return res
      .status(HttpStatus.OK.code)
      .json(
        new ApiResponse(
          HttpStatus.OK.code,
          orders,
          "User orders retrieved successfully"
        )
      );
  } catch (error) {
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR.code)
      .json(
        new ApiError(
          HttpStatus.INTERNAL_SERVER_ERROR.code,
          "Error while fetching user orders",
          error.message
        )
      );
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { orderStatus } = req.body;

    const validStatuses = [
      "Pending",
      "Processing",
      "Shipped",
      "Delivered",
      "Cancelled",
    ];
    if (!validStatuses.includes(orderStatus)) {
      return res
        .status(HttpStatus.BAD_REQUEST.code)
        .json(
          new ApiError(HttpStatus.BAD_REQUEST.code, "Invalid order status")
        );
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res
        .status(HttpStatus.NOT_FOUND.code)
        .json(new ApiError(HttpStatus.NOT_FOUND.code, "Order not found"));
    }

    order.orderStatus = orderStatus;
    await order.save();

    let trackingDetails = null;
    if (orderStatus === "Shipped" && order.shiprocketOrderId) {
      trackingDetails = await trackShiprocketOrder(order.shiprocketOrderId);
    }

    return res
      .status(HttpStatus.OK.code)
      .json(
        new ApiResponse(
          HttpStatus.OK.code,
          { order, trackingDetails },
          "Order status updated successfully"
        )
      );
  } catch (error) {
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR.code)
      .json(
        new ApiError(
          HttpStatus.INTERNAL_SERVER_ERROR.code,
          "Error while updating order status",
          error.message
        )
      );
  }
};

export const deleteOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);

    if (!order) {
      return res
        .status(HttpStatus.NOT_FOUND.code)
        .json(new ApiError(HttpStatus.NOT_FOUND.code, "Order not found"));
    }

    if (order.shiprocketOrderId) {
      try {
        await cancelShiprocketOrder(order.shiprocketOrderId);
      } catch (error) {
        console.error("Error cancelling Shiprocket order:", error.message);
      }
    }

    await Order.findByIdAndDelete(orderId);

    res
      .status(HttpStatus.OK.code)
      .json(
        new ApiResponse(HttpStatus.OK.code, null, "Order deleted successfully")
      );
  } catch (error) {
    res
      .status(HttpStatus.INTERNAL_SERVER_ERROR.code)
      .json(
        new ApiError(
          HttpStatus.INTERNAL_SERVER_ERROR.code,
          "Error while deleting an order",
          error.message
        )
      );
  }
};

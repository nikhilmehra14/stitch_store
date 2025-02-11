import { Order } from "../models/order.model.js";
import { Product } from "../models/product.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import { HttpStatus } from "../constants/status.code.js";
import Razorpay from "razorpay";
import { createShiprocketOrder, generateShippingLabel, trackShiprocketOrder } from "../services/shiprocket.service.js";
import mongoose from "mongoose";
import sendEmail from "../services/email.service.js";
import { verifyPayment } from "../services/payment.service.js";
import { sendAdminAlert, sendOrderConfirmationEmail, sendOrderShippedEmail } from "../utils/order.util.js";
import Cart from "../models/cart.model.js";

const ORDER_STATUS = {
  PENDING_PAYMENT: "Pending Payment",
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
      return res.status(HttpStatus.BAD_REQUEST.code)
        .json(new ApiError(HttpStatus.BAD_REQUEST.code, "Invalid order items format"));
    }


    if (!["razorpay", "upi"].includes(paymentMethod)) {
      return res
        .status(HttpStatus.BAD_REQUEST.code)
        .json(new ApiError(HttpStatus.BAD_REQUEST.code, "Invalid Payment Method"));
    }

    const cart = await Cart.findOne({ userId })
      .populate({
        path: 'items.productId',
        select: 'price product_name sku'
      })
      .session(session);

    if (!cart || cart.items.length === 0) {
      await session.abortTransaction();
      return res.status(HttpStatus.BAD_REQUEST.code)
        .json(new ApiError(HttpStatus.BAD_REQUEST.code, "Cart is empty"));
    }

    const cartItemsMap = new Map(
      cart.items.map(item => [item.productId._id.toString(), item])
    );

    const validatedOrderItems = [];
    let totalAmount = 0;

    for (const selectedItem of orderItems) {
      const cartItem = cartItemsMap.get(selectedItem.product);

      if (!cartItem) {
        await session.abortTransaction();
        return res.status(HttpStatus.BAD_REQUEST.code)
          .json(new ApiError(HttpStatus.BAD_REQUEST.code,
            `Product ${selectedItem.product} not found in cart`));
      }

      if (selectedItem.quantity > cartItem.quantity) {
        await session.abortTransaction();
        return res.status(HttpStatus.BAD_REQUEST.code)
          .json(new ApiError(HttpStatus.BAD_REQUEST.code,
            `Invalid quantity for product ${cartItem.productId.product_name}`));
      }

      const product = cartItem.productId;

      if (cartItem.price !== product.price) {
        await session.abortTransaction();
        return res.status(HttpStatus.BAD_REQUEST.code)
          .json(new ApiError(HttpStatus.BAD_REQUEST.code,
            `Price changed for ${product.product_name} - please refresh cart`));
      }

      validatedOrderItems.push({
        product: product._id,
        quantity: selectedItem.quantity,
        price: cartItem.discountedPrice || product.price,
        product_name: product.product_name,
        sku: product.sku
      });

      totalAmount += (cartItem.discountedPrice || product.price) * selectedItem.quantity;
    }

    const options = {
      amount: totalAmount * 100,
      currency: "INR",
      receipt: `order_rcptid_${Date.now()}`,
      notes: { user_id: userId.toString() },
    };


    const razorpayOrder = await razorpay.orders.create(options);

    const order = new Order({
      user: userId,
      orderItems: validatedOrderItems,
      totalAmount,
      shippingAddress,
      paymentMethod,
      razorpayOrderId: razorpayOrder.id,
      status: ORDER_STATUS.PENDING_PAYMENT,
      appliedCoupons: cart.appliedCoupons
    });

    await order.save({ session });

    const remainingItems = cart.items.filter(item =>
      !orderItems.some(selected => selected.product === item.productId._id.toString())
    );

    if (remainingItems.length === 0) {
      await Cart.deleteOne({ userId }).session(session);
    } else {
      cart.items = remainingItems;
      cart.totalPrice = remainingItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      await cart.save({ session });
    }

    await session.commitTransaction();

    return res.status(HttpStatus.CREATED.code)
      .json(new ApiResponse(HttpStatus.CREATED.code, {
        orderId: order._id,
        razorpayOrderId: razorpayOrder.id,
        amount: totalAmount,
        currency: "INR"
      }, "Order created successfully"));

  } catch (error) {
    await session.abortTransaction();
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR.code)
      .json(new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, error.message));
  } finally {
    session.endSession();
  }
}

export const confirmOrder = async (req, res) => {
  const { razorpayPaymentId, razorpayOrderId, razorpaySignature, orderId } = req.body;
  let order;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const verification = await verifyPayment(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (!verification.success) {
      await session.abortTransaction();
      return res.status(verification.error.statusCode).json(verification.error);
    }

    order = await Order.findOne({
      _id: orderId,
      razorpayOrderId
    }).session(session);

    if (!order) {
      await session.abortTransaction();
      return res.status(HttpStatus.NOT_FOUND.code)
        .json(new ApiError(HttpStatus.NOT_FOUND.code, "Order not found"));
    }

    if (order.paymentStatus !== "Pending") {
      await session.abortTransaction();
      return res.status(HttpStatus.BAD_REQUEST.code)
        .json(new ApiError(HttpStatus.BAD_REQUEST.code, "Order already processed"));
    }

    order.paymentStatus = "Completed";
    order.razorpayPaymentId = razorpayPaymentId;
    order.amountPaid = order.totalAmount;
    order.orderStatus = "Processing";

    await order.save({ session });
    await session.commitTransaction();

    await sendOrderConfirmationEmail(order);

    const shippingSession = await mongoose.startSession();
    shippingSession.startTransaction();

    try {
      const updatedOrder = await Order.findById(orderId).session(shippingSession);
      const shiprocketOrder = await createShiprocketOrder(updatedOrder);
      const shippingLabel = await generateShippingLabel(shiprocketOrder.order_id);

      updatedOrder.shiprocketOrderId = shiprocketOrder.order_id;
      updatedOrder.shippingLabel = shippingLabel.label_url;
      updatedOrder.orderStatus = "Shipped";

      await updatedOrder.save({ session: shippingSession });
      await shippingSession.commitTransaction();

      await sendOrderShippedEmail(updatedOrder, shiprocketOrder.shipment_id);

      return res.status(HttpStatus.OK.code)
        .json(new ApiResponse(HttpStatus.OK.code, updatedOrder, "Order confirmed & shipped"));

    } catch (shippingError) {
      await shippingSession.abortTransaction();

      console.error("Shipping processing failed:", shippingError);
      await sendAdminAlert(order, shippingError);

      return res.status(HttpStatus.OK.code)
        .json(new ApiResponse(
          HttpStatus.OK.code,
          order,
          "Payment confirmed but shipping processing failed. Admin notified."
        ));
    } finally {
      shippingSession.endSession();
    }

  } catch (error) {
    await session.abortTransaction();
    console.error("Order confirmation failed:", error);

    await sendAdminAlert(order || { _id: orderId }, error);

    return res.status(HttpStatus.INTERNAL_SERVER_ERROR.code)
      .json(new ApiError(
        HttpStatus.INTERNAL_SERVER_ERROR.code,
        "Order processing failed",
        error.message
      ));
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
        $lookup: {
          from: "products",
          localField: "orderItems.product",
          foreignField: "_id",
          as: "orderItems.productDetails",
        },
      },
      {
        $unwind: "$orderItems.productDetails",
      },
      {
        $addFields: {
          "orderItems.totalPrice": {
            $multiply: ["$orderItems.price", "$orderItems.quantity"],
          },
        },
      },
      {
        $project: {
          shippingAddress: 1,
          "orderItems.productId": "$orderItems.product",
          "orderItems.productName": "$orderItems.productDetails.product_name",
          "orderItems.sku": "$orderItems.productDetails.sku",
          "orderItems.category": "$orderItems.productDetails.category",
          "orderItems.description": "$orderItems.productDetails.description",
          "orderItems.price": 1,
          "orderItems.quantity": 1,
          "orderItems.totalPrice": 1,
          "orderItems.imageUrl": { $arrayElemAt: ["$orderItems.productDetails.images", 0] },
          user: {
            userId: "$userInfo._id",
            email: "$userInfo.email",
            fullName: "$userInfo.fullName",
          },
          totalAmount: {
            $sum: "$orderItems.totalPrice",
          },
          paymentStatus: 1,
          orderStatus: 1,
          paymentMethod: 1,
          currency: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
      {
        $addFields: {
          createdAt: { $toDate: "$createdAt" },
          updatedAt: { $toDate: "$updatedAt" },
        },
      },
      {
        $sort: { createdAt: -1 },
      },
    ]);

    res.status(HttpStatus.OK.code).json(
      new ApiResponse(HttpStatus.OK.code, orders, "Orders retrieved successfully")
    );
  } catch (error) {
    res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(
      new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error while fetching orders", error.message)
    );
  }
};


export const getUserOrders = async (req, res) => {
  try {
    const userId = req.user._id;
    const orders = await Order.find({ user: userId })
      .populate("orderItems.product");

    return res.status(HttpStatus.OK.code).json(
      new ApiResponse(HttpStatus.OK.code, orders, "User orders retrieved successfully")
    );
  } catch (error) {
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(
      new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error while fetching user orders", error.message)
    );
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { orderStatus } = req.body;

    const validStatuses = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"];
    if (!validStatuses.includes(orderStatus)) {
      return res.status(HttpStatus.BAD_REQUEST.code).json(
        new ApiError(HttpStatus.BAD_REQUEST.code, "Invalid order status")
      );
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(HttpStatus.NOT_FOUND.code).json(
        new ApiError(HttpStatus.NOT_FOUND.code, "Order not found")
      );
    }

    order.orderStatus = orderStatus;
    await order.save();

    // If order is marked as "Shipped", fetch tracking details from Shiprocket
    let trackingDetails = null;
    if (orderStatus === "Shipped" && order.shiprocketOrderId) {
      trackingDetails = await trackShiprocketOrder(order.shiprocketOrderId);
    }

    return res.status(HttpStatus.OK.code).json(
      new ApiResponse(HttpStatus.OK.code, { order, trackingDetails }, "Order status updated successfully")
    );
  } catch (error) {
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(
      new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error while updating order status", error.message)
    );
  }
};

export const deleteOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(HttpStatus.NOT_FOUND.code).json(
        new ApiError(HttpStatus.NOT_FOUND.code, "Order not found")
      );
    }

    if (order.shiprocketOrderId) {
      try {
        await cancelShiprocketOrder(order.shiprocketOrderId);
      } catch (error) {
        console.error("Error cancelling Shiprocket order:", error.message);
      }
    }

    await Order.findByIdAndDelete(orderId);

    res.status(HttpStatus.OK.code).json(
      new ApiResponse(HttpStatus.OK.code, null, "Order deleted successfully")
    );
  } catch (error) {
    res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(
      new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error while deleting an order", error.message)
    );
  }
};

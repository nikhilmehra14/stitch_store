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

    if (!["razorpay", "upi"].includes(paymentMethod)) {
      return res
        .status(HttpStatus.BAD_REQUEST.code)
        .json(new ApiError(HttpStatus.BAD_REQUEST.code, "Invalid Payment Method"));
    }

    let totalAmount = 0;
    for (const item of orderItems) {
      const product = await Product.findById(item.product).session(session);
      if (!product) {
        await session.abortTransaction();
        session.endSession();
        return res.status(HttpStatus.NOT_FOUND.code)
          .json({ message: `Product ${item.product} not found` });
      }
      totalAmount += product.price * item.quantity;
    }

    const options = {
      amount: totalAmount * 100,
      currency: "INR",
      receipt: `order_rcptid_${Date.now()}`,
      notes: { user_id: userId },
    };

    const razorpayOrder = await razorpay.orders.create(options);

    const order = new Order({
      user: userId,
      orderItems,
      totalAmount,
      shippingAddress,
      paymentMethod,
      razorpayOrderId: razorpayOrder.id,
      status: ORDER_STATUS.PENDING_PAYMENT,
    });

    await order.save({ session });

    await session.commitTransaction();
    session.endSession();


    return res.status(HttpStatus.CREATED.code).json({
      orderId: order.id,
      razorpayOrderId: razorpayOrder.id,
      amount: totalAmount,
      currency: "INR",
      message: "Order created. Awaiting payment.",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR.code)
      .json(new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error while creating order", error.message));
  }
};

export const confirmOrder = async (req, res) => {
  const { razorpayPaymentId, razorpayOrderId, razorpaySignature, orderId } = req.body;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const paymentVerificationResponse = await verifyPayment(req, res);

    if (paymentVerificationResponse.status !== HttpStatus.OK.code) {
      await session.abortTransaction();
      session.endSession();
      return paymentVerificationResponse;
    }

    const order = await Order.findById(orderId).session(session);
    if (!order || order.paymentStatus !== "Pending") {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(HttpStatus.BAD_REQUEST.code)
        .json(new ApiError(HttpStatus.BAD_REQUEST.code, "Invalid or already confirmed order."));
    }

    order.paymentStatus = "Completed";
    order.orderStatus = "Processing";
    order.razorpayPaymentId = razorpayPaymentId;
    order.amountPaid = order.totalAmount;
    await order.save({ session });

    const orderConfirmationHTML = `
      <p>Hi ${order.shippingAddress.name},</p>
      <p>Your order <strong>#${order._id}</strong> has been successfully placed.</p>
    `;

    sendEmail(
      order.shippingAddress.email,
      "Order Placed Successfully",
      `Your order #${order._id} has been placed successfully.`,
      orderConfirmationHTML
    );

    const shiprocketOrder = await createShiprocketOrder(order);
    const shippingLabel = await generateShippingLabel(shiprocketOrder.order_id);

    order.shiprocketOrderId = shiprocketOrder.order_id;
    order.shippingLabel = shippingLabel.label_url;
    order.orderStatus = "Shipped";
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    const orderShippedHTML = `
      <p>Your order <strong>#${order._id}</strong> has been shipped.</p>
      <p>Track your order <a href="https://shiprocket.co/tracking/${shiprocketOrder.shipment_id}">here</a>.</p>
    `;

    sendEmail(
      order.shippingAddress.email,
      "Order Shipped",
      `Your order #${order._id} has been shipped.`,
      orderShippedHTML
    );

    logger.info(`Order shipped successfully: ${order._id}`);

    return res
      .status(HttpStatus.OK.code)
      .json(new ApiResponse(HttpStatus.OK.code, [], "Order confirmed & shipped."));

  } catch (error) {
    await session.abortTransaction();
    session.endSession();


    const adminEmail = process.env.ADMIN_EMAIL;
    const adminNotificationHTML = `
      <p>Shiprocket API failed for order <strong>#${order._id}</strong>.</p>
      <p>Error: ${error.message}</p>
    `;

    sendEmail(
      adminEmail,
      "Shiprocket API Failure",
      "Shiprocket API failed for an order.",
      adminNotificationHTML
    );

    return res
      .status(HttpStatus.OK.code)
      .json(new ApiError(HttpStatus.OK.code, "Order confirmed, but shipment failed. Admin notified.", error.message));
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

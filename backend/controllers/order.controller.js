import { Order } from "../models/order.model.js";
import { Product } from "../models/product.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import { HttpStatus } from "../constants/status.code.js";
import Razorpay from "razorpay";
import { createShiprocketOrder, generateShippingLabel, trackShiprocketOrder } from "../services/shiprocket.service.js";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export const createOrder = async (req, res) => {
  try {
    const { orderItems, shippingAddress, paymentMethod } = req.body;
    const userId = req.user._id;

    if (!["razorpay", "upi"].includes(paymentMethod)) {
      return res
        .status(HttpStatus.BAD_REQUEST.code)
        .json(new ApiError(HttpStatus.BAD_REQUEST.code, "Invalid Payment Method"));
    }

    let totalAmount = 0;
    for (const item of orderItems) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res
          .status(HttpStatus.NOT_FOUND.code)
          .json(new ApiError(HttpStatus.NOT_FOUND.code, `Product with ID ${item.product} not found`));
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
    });

    await order.save();

    // Prepare order details for Shiprocket
    const shiprocketOrderDetails = {
      order_id: order._id.toString(),
      order_date: new Date().toISOString(),
      pickup_location: "Primary",
      channel_id: "",
      comment: `Order created via ${process.env.EMAIL_SUPPORT}`,
      billing_customer_name: shippingAddress.name,
      billing_last_name: "",
      billing_address: shippingAddress.addressLine1,
      billing_address_2: shippingAddress.addressLine2,
      billing_city: shippingAddress.city,
      billing_pincode: shippingAddress.zipCode,
      billing_state: shippingAddress.state,
      billing_country: shippingAddress.country,
      billing_email: process.env.EMAIL_SUPPORT,
      billing_phone: shippingAddress.phone,
      shipping_is_billing: true,
      shipping_customer_name: shippingAddress.name,
      shipping_last_name: "",
      shipping_address: shippingAddress.addressLine1,
      shipping_address_2: shippingAddress.addressLine2,
      shipping_city: shippingAddress.city,
      shipping_pincode: shippingAddress.zipCode,
      shipping_country: shippingAddress.country,
      shipping_phone: shippingAddress.phone,
      order_items: orderItems.map((item) => ({
        name: item.name,
        sku: item.product.toString(),
        units: item.quantity,
        selling_price: item.price,
      })),
      payment_method: "Prepaid", // or "COD"
      shipping_charges: 0, // Add shipping charges if applicable
      total_discount: 0, // Add discount if applicable
      sub_total: totalAmount,
      length: 10, // Dimensions of the package
      breadth: 10,
      height: 10,
      weight: 1, // Weight of the package in kg
    };

    const shiprocketOrder = await createShiprocketOrder(shiprocketOrderDetails);

    const shippingLabel = await generateShippingLabel(shiprocketOrder.order_id);

    order.shiprocketOrderId = shiprocketOrder.order_id;
    order.shippingLabel = shippingLabel.label_url;
    await order.save();

    return res.status(HttpStatus.CREATED.code).json(
      new ApiResponse(HttpStatus.CREATED.code, {
        orderId: order.id,
        razorpayOrderId: razorpayOrder.id,
        amount: totalAmount,
        currency: "INR",
        key_id: razorpay.key_id,
        shiprocketOrderId: shiprocketOrder.order_id,
        shippingLabel: shippingLabel.label_url,
      }, "Order created and shipping label generated successfully")
    );
  } catch (error) {
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR.code)
      .json(new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error while creating order", error.message));
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

import Razorpay from "razorpay";
import crypto from "crypto";
import { validateWebhookSignature } from "razorpay/dist/utils/razorpay-utils.js";
import { Order } from "../models/order.model.js";
import { HttpStatus } from "../constants/status.code.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import { sendOrderConfirmationEmail } from "../utils/order.util.js";
import { clearCart } from "../controllers/order.controller.js";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export const verifyPayment = async (
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature
) => {
  try {
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return {
        success: false,
        error: new ApiError(
          HttpStatus.BAD_REQUEST.code,
          "Invalid payment details provided"
        ),
      };
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    const body = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpaySignature) {
      return {
        success: false,
        error: new ApiError(
          HttpStatus.UNAUTHORIZED.code,
          "Payment verification failed - Invalid signature"
        ),
      };
    }

    const payment = await razorpay.payments.fetch(razorpayPaymentId);
    if (payment.status !== "captured") {
      return {
        success: false,
        error: new ApiError(
          HttpStatus.BAD_REQUEST.code,
          `Payment not captured. Status: ${payment.status}`
        ),
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: new ApiError(
        HttpStatus.INTERNAL_SERVER_ERROR.code,
        "Payment verification failed",
        error.message
      ),
    };
  }
};

export const razorpayWebhook = async (req, res) => {
  try {
    const webhookSignature = req.headers["x-razorpay-signature"];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    const isValid = validateWebhookSignature(
      JSON.stringify(req.body),
      webhookSignature,
      webhookSecret
    );

    if (!isValid) {
      console.error("Invalid webhook signature");
      return res
        .status(HttpStatus.UNAUTHORIZED.code)
        .json(new ApiError(HttpStatus.UNAUTHORIZED.code, "Invalid signature"));
    }

    const event = req.body;

    if (event.event === "payment.captured") {
      const payment = event.payload.payment.entity;
      await updateOrderAfterPayment(payment);
    }

    return res.status(HttpStatus.OK.code).json(
      new ApiResponse(HttpStatus.OK.code, {
        event: event.event,
        success: true,
      })
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR.code)
      .json(
        new ApiError(
          HttpStatus.INTERNAL_SERVER_ERROR.code,
          "Webhook processing failed",
          error.message
        )
      );
  }
};

async function updateOrderAfterPayment(payment) {
  const order = await Order.findOne({ razorpayOrderId: payment.order_id });
  if (!order) {
    console.error(`Order not found for payment ${payment.id}`);
    return;
  }

  if (order.status === ORDER_STATUS.PAID) {
    return;
  }


  order.status = ORDER_STATUS.PAID;
  order.razorpayPaymentId = payment.id;
  order.amountPaid = payment.amount / 100;
  await order.save();

  await clearCart(order.user);
  await sendOrderConfirmationEmail(order);
}

export default razorpay;

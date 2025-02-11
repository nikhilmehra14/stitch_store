import Razorpay from "razorpay";
import crypto from "crypto";
import {
  validateWebhookSignature,
} from "razorpay/dist/utils/razorpay-utils.js";
import { Order } from "../models/order.model.js";
import { HttpStatus } from "../constants/status.code.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export const verifyPayment = async (razorpayOrderId, razorpayPaymentId, razorpaySignature) => {
  try {
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return { 
        success: false,
        error: new ApiError(HttpStatus.BAD_REQUEST.code, "Invalid payment details provided")
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
        error: new ApiError(HttpStatus.UNAUTHORIZED.code, "Payment verification failed - Invalid signature")
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
      )
    };
  }
};


// app.get("/payment-success", (req, res) => {
//   res.sendFile(Path.join(__dirname, "success.html"));
// });

// export default razorpay;

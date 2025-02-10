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

export const verifyPayment = async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
  try {
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res
        .status(HttpStatus.BAD_REQUEST.code)
        .json(new ApiError(HttpStatus.BAD_REQUEST.code, "Invalid payment details provided"));
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    const body = `${razorpayOrderId}|${razorpayPaymentId}`;

    const expectedSignature = crypto.createHmac("sha256", secret).update(body).digest("hex");
    if (expectedSignature !== razorpaySignature) {
      return res
        .status(HttpStatus.UNAUTHORIZED.code)
        .json(new ApiError(HttpStatus.UNAUTHORIZED.code, "Payment verification failed - Invalid signature"));
    }

    const order = await Order.findOne({ razorpayOrderId });
    if (!order) {
      return res
        .status(HttpStatus.NOT_FOUND.code)
        .json(new ApiError(HttpStatus.NOT_FOUND.code, "Order not found"));
    }

    order.paymentStatus = "Completed";
    order.razorpayPaymentId = razorpayPaymentId;
    order.amountPaid = order.totalAmount;
    await order.save();

    console.log(`Payment verified successfully for Order ID: ${razorpayOrderId}`);

    return res
      .status(HttpStatus.OK.code)
      .json(new ApiResponse(HttpStatus.OK.code, [], "Payment verified successfully"));

  } catch (error) {
    console.error(`Error while verifying payment: ${error.message}`, error);
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR.code)
      .json(new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error while verifying payment", error.message));
  }
};


// app.get("/payment-success", (req, res) => {
//   res.sendFile(Path.join(__dirname, "success.html"));
// });

// export default razorpay;

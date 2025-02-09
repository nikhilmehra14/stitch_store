import Razorpay from "razorpay";
import app from "../app.js";
import {
  validateWebhookSignature,
} from "razorpay/dist/utils/razorpay-utils";
import { Order } from "../models/order.model.js";
import { HttpStatus } from "../constants/status.code.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

app.post("/verify-payment", async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    req.body;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  const body = razorpay_order_id + "|" + razorpay_payment_id;

  try {
    const isValidSignature = validateWebhookSignature(
      body,
      razorpay_signature,
      secret
    );
    if (isValidSignature) {
      const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });
      if (order) {
        order.paymentStatus = "Paid";
        order.paymentId = razorpay_payment_id;
        await order.save();

        res
          .status(HttpStatus.OK.code)
          .json(
            new ApiResponse(
              HttpStatus.OK.code,
              [],
              "Payment verified successfully"
            )
          );
      }
    } else {
      res
        .status(HttpStatus.BAD_REQUEST.code)
        .json(
          new ApiError(
            HttpStatus.BAD_REQUEST.code,
            "Payment verification failed"
          )
        );
    }
  } catch (error) {
    console.log(`Error while verifying payment: ${error.message}`);
    res
      .status(HttpStatus.INTERNAL_SERVER_ERROR.code)
      .json(
        new ApiError(
          HttpStatus.INTERNAL_SERVER_ERROR,
          "Error while verifying payment",
          error.message
        )
      );
  }
});

app.get("/payment-success", (req, res) => {
  res.sendFile(Path.join(__dirname, "success.html"));
});

export default razorpay;

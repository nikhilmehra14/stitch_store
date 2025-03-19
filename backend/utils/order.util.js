import { User } from "../models/user.model.js";
import sendEmail from "../services/email.service.js";
import dotenv from "dotenv";
dotenv.config();

const formatOrderDate = (date) => {
  return new Date(date).toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export const sendOrderConfirmationEmail = async (order) => {
  try {
    const user = await User.findById(order.user).select("email");
    if (!user || !user.email) {
      throw new Error("User email not found");
    }

    const formattedDate = formatOrderDate(order.createdAt);
    const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; }
              .container { max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; }
              .header { text-align: center; border-bottom: 2px solid #eee; padding-bottom: 15px; }
              .product-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
              .product-table th, .product-table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2>Order Confirmation</h2>
              </div>
              <p>Hello ${order.shippingAddress.name},</p>
              <p>Thank you for your order! We're preparing your items for shipment.</p>
              <p>Order Date: ${formattedDate}</p>
              <table class="product-table">
                <thead>
                  <tr><th>Product</th><th>Quantity</th><th>Price</th></tr>
                </thead>
                <tbody>
                  ${order.orderItems
                    .map(
                      (item) => `<tr>
                    <td>${item.product_name} (${item.sku})</td>
                    <td>${item.quantity}</td>
                    <td>₹${item.price.toFixed(2)}</td>
                  </tr>`
                    )
                    .join("")}
                </tbody>
              </table>
              <p><strong>Total: ₹${order.totalAmount.toFixed(2)}</strong></p>
            </div>
          </body>
          </html>`;

    const text = `Thank you for your order #${order._id?.toString().slice(-6).toUpperCase() || "UNKNOWN"}
            Total: ₹${order.totalAmount.toFixed(2)}
            We'll notify you when your items ship.`;

    await sendEmail(user.email, `Order Confirmation #${order._id}`, text, html);
  } catch (error) {
    console.error("Failed to send order confirmation email:", error.message);
  }
};

export const sendAdminAlert = async (order, error) => {
  try {
    const adminEmails = [
      process.env.EMAIL,
      process.env.EMAIL_SUPPORT,
      process.env.EMAIL_NOREPLY,
    ].filter((email) => email);

    if (adminEmails.length === 0) {
      console.warn("No admin emails configured for alerts.");
      return;
    }

    const orderId = order?._id?.toString() || "Unknown Order";
    const html = `
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; }
              .container { max-width: 800px; margin: 20px auto; padding: 20px; border: 1px solid #e0e0e0; }
              .header { color: #dc3545; border-bottom: 2px solid #dc3545; padding-bottom: 10px; }
              pre { background: #f8f9fa; padding: 15px; border-radius: 4px; overflow-x: auto; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header"><h2>🚨 Order Processing Alert</h2></div>
              <p><strong>Order ID:</strong> ${orderId}</p>
              <p><strong>Error:</strong> ${error.message}</p>
              <pre>${error.stack}</pre>
            </div>
          </body>
          </html>`;

    const text = `CRITICAL ALERT: Order Processing Failure\n
              Order ID: ${orderId}\n
              Error: ${error.message}\n`;

    await Promise.allSettled(
      adminEmails.map((email) =>
        sendEmail(
          email.trim(),
          `[Action Required] Order Failure: ${orderId}`,
          text,
          html
        )
      )
    );
  } catch (error) {
    console.error("Failed to send admin alert email:", error.message);
  }
};

export const sendOrderShippedEmail = async (order, shipmentId) => {
  try {
    const user = await User.findById(order.user).select("email");
    if (!user?.email) {
      throw new Error("User email not found");
    }

    const html = `
          <html>
          <head>
            <style>
              .tracking-box { background: #f8f9fa; padding: 15px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <h2>Your Order Has Shipped!</h2>
              <p>Tracking Number: ${shipmentId}</p>
              <p><a href="https://track.shiprocket.com/${shipmentId}">Track your order</a></p>
            </div>
          </body>
          </html>`;

    const text = `Your order #${order._id} has shipped!
            Tracking ID: ${shipmentId}
            Track here: https://track.shiprocket.com/${shipmentId}`;

    await sendEmail(user.email, `Order Shipped #${order._id}`, text, html);
  } catch (error) {
    console.error("Failed to send order shipped email:", error.message);
  }
};

export const sendOrderCancelledEmail = async (order) => {
  try {
    const user = await User.findById(order.user).select("email");
    if (!user?.email) {
      throw new Error("User email not found");
    }

    const html = `
          <html>
          <body>
            <div class="container">
              <h2>Your Order Has Been Cancelled</h2>
              <p>We regret to inform you that your order #${order._id} has been cancelled.</p>
            </div>
          </body>
          </html>`;

    const text = `Your order #${order._id} has been cancelled.`;

    await sendEmail(user?.email, `Order Cancelled #${order._id}`, text, html);
  } catch (error) {
    console.error("Failed to send order cancellation email:", error.message);
  }
};

export const sendPaymentFailureEmail = async (order) => {
  try {
    const user = await User.findById(order.user).select("email");
    if (!user?.email) {
      throw new Error("User email not found");
    }

    const html = `
          <html>
          <body>
            <div class="container">
              <h2>Payment Failure</h2>
              <p>Unfortunately, your payment for order #${order._id} was not successful. Please try again.</p>
            </div>
          </body>
          </html>`;

    const text = `Payment for order #${order._id} failed. Please try again.`;

    await sendEmail(user?.email, `Payment Failed #${order._id}`, text, html);
  } catch (error) {
    console.error("Failed to send payment failure email:", error.message);
  }
};

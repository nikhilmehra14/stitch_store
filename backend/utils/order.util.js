import sendEmail from "../services/email.service.js";

export const sendOrderConfirmationEmail = async (order) => {
    const formattedDate = new Date(order.createdAt).toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; }
          .header { text-align: center; border-bottom: 2px solid #eee; padding-bottom: 15px; }
          .logo { max-width: 150px; }
          .order-details { margin: 20px 0; }
          .product-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          .product-table th, .product-table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
          .total { font-size: 1.1em; font-weight: bold; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="https://your-store.com/logo.png" alt="Store Logo" class="logo">
            <h2>Order Confirmation</h2>
          </div>
          
          <p>Hello ${order.shippingAddress.name},</p>
          <p>Thank you for your order! We're preparing your items for shipment.</p>
  
          <div class="order-details">
            <h3>Order #${order._id.toString().slice(-6).toUpperCase()}</h3>
            <p>Order Date: ${formattedDate}</p>
            
            <table class="product-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                ${order.orderItems.map(item => `
                  <tr>
                    <td>${item.product_name} (${item.sku})</td>
                    <td>${item.quantity}</td>
                    <td>₹${item.price.toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
  
            <div class="total">
              Total Amount: ₹${order.totalAmount.toFixed(2)}
            </div>
          </div>
  
          <p>Shipping Address:<br>
            ${order.shippingAddress.addressLine1}<br>
            ${order.shippingAddress.addressLine2 || ''}<br>
            ${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.zipCode}
          </p>
  
          <p>We'll notify you when your items ship!</p>
        </div>
      </body>
      </html>
    `;

    const text = `Thank you for your order #${order._id.toString().slice(-6).toUpperCase()}\n
      Total: ₹${order.totalAmount.toFixed(2)}\n
      We'll notify you when your items ship.`;

    await sendEmail(
        order.shippingAddress.email,
        `Order Confirmation #${order._id.toString().slice(-6).toUpperCase()}`,
        text,
        html
    );
};

export const sendOrderShippedEmail = async (order, shipmentId) => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          /* Similar styling to confirmation email */
          .tracking-box { background: #f8f9fa; padding: 15px; margin: 20px 0; }
          .tracking-link { color: #2c3e50; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Your Order Has Shipped!</h2>
          </div>
          
          <p>Hello ${order.shippingAddress.name},</p>
          <p>Your order #${order._id.toString().slice(-6).toUpperCase()} is on the way!</p>
  
          <div class="tracking-box">
            <h3>Tracking Information</h3>
            <p>Tracking Number: ${shipmentId}</p>
            <p>Track your package: 
              <a href="https://track.shiprocket.com/${shipmentId}" class="tracking-link">
                View Tracking
              </a>
            </p>
          </div>
  
          <p>Expected delivery: 3-5 business days</p>
        </div>
      </body>
      </html>
    `;

    const text = `Your order #${order._id.toString().slice(-6).toUpperCase()} has shipped!\n
      Tracking ID: ${shipmentId}\n
      Track here: https://track.shiprocket.com/${shipmentId}`;

    await sendEmail(
        order.shippingAddress.email,
        `Order Shipped #${order._id.toString().slice(-6).toUpperCase()}`,
        text,
        html
    );
};

export const sendAdminAlert = async (order, error) => {
    try {
        const adminEmails = process.env.EMAIL;
        const orderId = order?._id?.toString() || 'Unknown Order';
        const paymentId = order?.razorpayPaymentId || 'N/A';

        const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; }
            .container { max-width: 800px; margin: 20px auto; padding: 20px; border: 1px solid #e0e0e0; }
            .header { color: #dc3545; border-bottom: 2px solid #dc3545; padding-bottom: 10px; }
            .details { margin: 20px 0; }
            table { width: 100%; border-collapse: collapse; }
            td, th { padding: 12px; border: 1px solid #ddd; text-align: left; }
            pre { background: #f8f9fa; padding: 15px; border-radius: 4px; overflow-x: auto; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>🚨 Order Processing Alert</h2>
              <p>${new Date().toLocaleString()}</p>
            </div>
  
            <div class="details">
              <h3>Order Context</h3>
              <table>
                <tr>
                  <th>Order ID</th>
                  <td>${orderId}</td>
                </tr>
                <tr>
                  <th>Payment ID</th>
                  <td>${paymentId}</td>
                </tr>
                <tr>
                  <th>Order Status</th>
                  <td>${order?.orderStatus || 'N/A'}</td>
                </tr>
                <tr>
                  <th>Payment Status</th>
                  <td>${order?.paymentStatus || 'N/A'}</td>
                </tr>
              </table>
  
              <h3 style="margin-top: 25px;">Error Details</h3>
              <pre>${error.stack || error.message}</pre>
  
              <h3>Next Steps</h3>
              <ul>
                <li>Check server logs for complete error trace</li>
                <li>Verify payment status in Razorpay dashboard</li>
                <li>Review order in admin panel: 
                  <a href="${process.env.EMAIL_SUPPORT}/orders/${orderId}">
                    View Order
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </body>
        </html>
      `;

        const text = `CRITICAL ALERT: Order Processing Failure
        \nOrder ID: ${orderId}
        \nError: ${error.message}
        \nTimestamp: ${new Date().toISOString()}
        \nImmediate Action Required!`;

        await Promise.all(adminEmails.map(email =>
            sendEmail(
                email.trim(),
                `[Action Required] Order Failure: ${orderId}`,
                text,
                html
            )
        ));

        console.error(`Admin alerted for order ${orderId}:`, error);

    } catch (alertError) {
        console.error('Failed to send admin alert:', alertError);
    }
};
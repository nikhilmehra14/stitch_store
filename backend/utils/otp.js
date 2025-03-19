import redisClient from "../services/redis.service.js";
import sendEmail from "../services/email.service.js";

let isConnected = false;
export const initializeRedis = async () => {
  if (!isConnected) {
    try {
      await redisClient.connect();
      isConnected = true;
    } catch (error) {
      console.error("Failed to connect to Redis:", error.message);
      throw error;
    }
  }
};


export const generateAndStoreOTP = async (email) => {
  try {
    if (!redisClient.isOpen) {
      console.log("Reconnecting to Redis...");
      await redisClient.connect();
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresIn = 300;

    await redisClient.setEx(email, expiresIn, otp);
    return otp;
  } catch (error) {
    console.error("OTP Generation Error:", error.message);
    throw new Error("Failed to generate and store OTP");
  }
};


export const verifyOTP = async (email, otp) => {
  try {
    if (!redisClient.isOpen) {
      console.log("Reconnecting to Redis...");
      await redisClient.connect();
    }

    const storedOTP = await redisClient.get(email);
  
    if (!storedOTP || storedOTP !== otp) return false;

    await redisClient.del(email);
    return true;
  } catch (error) {
    console.error("OTP Verification Error:", error.message);
    throw new Error("Failed to verify OTP");
  }
};



export const sendOtpEmail = async (to, name, otp) => {
  try {
    const subject = "Your One-Time Password (OTP) - The Stitch Store";
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style type="text/css">
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 20px 0; }
        .logo { max-width: 150px; }
        .content { background-color: #f7f7f7; padding: 30px; border-radius: 10px; }
        .otp-code { font-size: 32px; font-weight: bold; color: #2c3e50; margin: 20px 0; text-align: center; }
        .footer { text-align: center; padding: 20px; color: #666666; font-size: 12px; }
        .button { background-color: #2c3e50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="https://example.com/logo.png" alt="The Stitch Store Logo" class="logo">
        </div>
        
        <div class="content">
          <h2 style="color: #2c3e50; margin-top: 0;">Hi ${name},</h2>
          <p>Your one-time verification code is:</p>
          <div class="otp-code">${otp}</div>
          <p>This code will expire in 10 minutes. Please use it to complete your action.</p>
          <p>If you didn't request this code, please ignore this email or contact our support team immediately at <a href="mailto:${process.env.EMAIL_SUPPORT}">${process.env.EMAIL_SUPPORT}</a>.</p>
        </div>

        <div class="footer">
          <p>© ${new Date().getFullYear()} The Stitch Store. All rights reserved.</p>
          <p>Need help? Contact us at <a href="mailto:${process.env.EMAIL_SUPPORT}">${process.env.EMAIL_SUPPORT}</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

    const text = `
    Hi ${name},

    Your one-time password (OTP) is: ${otp}

    Please use this OTP to complete your action. This OTP will expire in 10 minutes.

    If you did not request this, please ignore this email or contact ${process.env.EMAIL_SUPPORT}

    Thank you,
    The The Stitch Store
  `;

    await sendEmail(to, subject, text, html);
  } catch (error) {
    console.error("Email Sending Error:", error.message);
    throw new Error("Failed to send OTP email");
  }
};

export const closeRedisConnection = async () => {
  if (redisClient.isOpen) {
    await redisClient.quit();
    isConnected = false;
    console.log("Redis connection closed");
  }
};

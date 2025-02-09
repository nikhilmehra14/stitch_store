import sendEmail from "../services/email.service.js";

const otpStore = new Map();

export const generateAndStoreOTP = (key) => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000;

  otpStore.set(key, { otp, expiresAt });

  return otp;
};

export const verifyOTP = (key, otp) => {
  const storedOTP = otpStore.get(key);

  if (!storedOTP) return false;
  if (storedOTP.expiresAt < Date.now()) {
    otpStore.delete(key);
    return false;
  }
  if (storedOTP.otp !== otp) return false;

  otpStore.delete(key);
  return true;
};


export const sendOtpEmail = async (to, name, otp) => {
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
};
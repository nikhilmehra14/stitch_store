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
  const subject = "Your One-Time Password (OTP)";
  const text = `
    Hi ${name},

    Your one-time password (OTP) is: ${otp}

    Please use this OTP to complete your action. This OTP will expire in 10 minutes.

    If you did not request this, please ignore this email or contact ${process.env.EMAIL_SUPPORT}

    Thank you,
    The The Stitch Store
  `;

  await sendEmail(to, subject, text);
};
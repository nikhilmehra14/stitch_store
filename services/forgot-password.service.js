import sendEmail from "./email.service.js";

export const sendResetPasswordEmail = async (to, name, resetURL) => {
  const subject = "Password Reset Request";
  const text = `
    Hello ${name},

    You have requested to reset your password. Please click the link below to reset your password:
    
    ${resetURL}

    The link will expire in 15 minutes.

    If you did not request this, please ignore this email or contact ${process.env.EMAIL_SUPPORT}

    Thank you,
    The Stitch Store
  `;

  await sendEmail(to, subject, text);
};

export default sendResetPasswordEmail;
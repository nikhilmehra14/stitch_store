import sendEmail from "./email.service.js";

export const sendResetPasswordEmail = async (to, name, resetURL) => {
  const subject = "Password Reset Request - The Stitch Store";
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
        .cta-button { background-color: #2c3e50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666666; font-size: 12px; }
        .reset-link { word-break: break-all; color: #2c3e50; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="https://example.com/logo.png" alt="The Stitch Store Logo" class="logo">
        </div>
        
        <div class="content">
          <h2 style="color: #2c3e50; margin-top: 0;">Hi ${name},</h2>
          <p>We received a request to reset your password. Click the button below to proceed:</p>
          
          <div style="text-align: center; margin: 25px 0;">
            <a href="${resetURL}" class="cta-button">Reset Password</a>
          </div>

          <p>Or copy and paste this link into your browser:</p>
          <p class="reset-link">${resetURL}</p>
          
          <p>This link will expire in 15 minutes. If you didn't request this password reset, please ignore this email or contact our support team immediately at <a href="mailto:${process.env.EMAIL_SUPPORT}">${process.env.EMAIL_SUPPORT}</a>.</p>
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
    Hello ${name},

    You have requested to reset your password. Please click the link below to reset your password:
    
    ${resetURL}

    The link will expire in 15 minutes.

    If you did not request this, please ignore this email or contact ${process.env.EMAIL_SUPPORT}

    Thank you,
    The Stitch Store
  `;

  await sendEmail(to, subject, text, html);
};

export default sendResetPasswordEmail;
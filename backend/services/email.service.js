import nodemailer from "nodemailer";

const sendEmail = async (to, subject, text, html) => {
  const transporter = nodemailer.createTransport({
    host: "smtp.hostinger.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL,
      pass: process.env.EMAIL_PASSWORD,
    },
    tls: {
      minVersion: "TLSv1.2",
    },
    debug: true,
    logger: true,
  });

  try {
    const mailOptions = {
      from: process.env.EMAIL_NOREPLY,
      to,
      subject,
      text,
      html,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log("Email result: ", result);
    console.log(`✅ Email sent successfully to ${to}`);
    return result;
  } catch (error) {
    console.error("❌ Error sending email:", error);
    throw new Error(`Email sending failed: ${error.message}`);
  }
};

export default sendEmail;
import nodemailer from "nodemailer";

const sendEmail = async (to, subject, text) => {
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
    const result = await transporter.sendMail({
      from: process.env.EMAIL_NOREPLY,
      to,
      subject,
      text,
    });
    console.log("Result: ",result);
    console.log(`✅ Email sent successfully to ${to}`);
  } catch (error) {
    console.error("❌ Error sending email:", error);
    throw new Error(`Error sending email: ${error.message}`);
  }
};

export default sendEmail;

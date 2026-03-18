import nodemailer from "nodemailer";

const resolveEmailConfig = () => {
  if (process.env.BREVO_SMTP_USER && (process.env.BREVO_SMTP_PASS || process.env.BREVO_API_KEY)) {
    return {
      host: process.env.BREVO_SMTP_HOST || "smtp-relay.brevo.com",
      port: Number(process.env.BREVO_SMTP_PORT || process.env.SMTP_PORT || 587),
      secure: String(process.env.BREVO_SMTP_SECURE || "false").toLowerCase() === "true",
      auth: {
        user: process.env.BREVO_SMTP_USER,
        pass: process.env.BREVO_SMTP_PASS || process.env.BREVO_API_KEY
      }
    };
  }

  return {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure:
      String(process.env.SMTP_SECURE || "").toLowerCase() === "true" ||
      Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  };
};

const emailConfig = resolveEmailConfig();

const hasConfiguredTransport = Boolean(
  emailConfig.host && emailConfig.auth?.user && emailConfig.auth?.pass
);

const transporter = hasConfiguredTransport ? nodemailer.createTransport(emailConfig) : null;

export const verifyEmailTransport = async () => {
  if (!transporter) {
    throw new Error("Email service is not configured. Set valid SMTP credentials.");
  }

  await transporter.verify();
  return true;
};

const messageTemplate = (content) => {
  return `
  <div style="font-family:Arial,sans-serif;background:#f6f8fa;padding:20px">
    <div style="max-width:600px;margin:auto;background:white;border-radius:6px;overflow:hidden">
      <div style="background:#111827;color:white;padding:15px">
        <h2>MakeASite</h2>
      </div>
      <div style="padding:20px;font-size:15px;color:#333">
        ${content}
      </div>
      <div style="background:#f1f1f1;padding:10px;text-align:center;font-size:12px;color:#777">
        &copy; ${new Date().getFullYear()} MakeASite. All rights reserved.
      </div>
    </div>
  </div>
  `;
};

export const sendEmail = async ({ to, subject, html }) => {
  if (!transporter) {
    throw new Error("Email service is not configured. Set SMTP credentials before sending email.");
  }

  try {
    const info = await transporter.sendMail({
      from:
        process.env.EMAIL_FROM ||
        `"${process.env.FROM_NAME || "MakeASite"}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
      to,
      subject,
      html: messageTemplate(html)
    });

    console.log("Email sent:", info.messageId);
    return info;
  } catch (error) {
    if (error.code === "EAUTH" || error.responseCode === 535) {
      throw new Error(
        "Email service authentication failed. Update your SMTP credentials or use a valid Brevo SMTP password."
      );
    }

    throw new Error(error.message || "Unable to send email");
  }
};

export const sendWelcomeEmail = async (to, name) => {
  const content = `
  <p>Hello <b>${name}</b>,</p>
  <p>Welcome to <b>MakeASite</b>.</p>
  <p>Your account has been successfully created.</p>
  <br>
  <p>Best Regards,<br>MakeASite Team</p>
  `;

  await sendEmail({ to, subject: "Welcome to MakeASite", html: content });
};

export const sendOtpEmail = async (to, otp) => {
  const content = `
  <p>Your login OTP is:</p>
  <h2 style="letter-spacing:4px">${otp}</h2>
  <p>This OTP will expire in <b>5 minutes</b>.</p>
  `;

  await sendEmail({ to, subject: "Your Login OTP", html: content });
};

export const sendPasswordResetEmail = async (to, name, resetLink) => {
  const content = `
  <p>Hello <b>${name}</b>,</p>
  <p>You requested a password reset.</p>
  <p><a href="${resetLink}" style="background:#2563eb;color:white;padding:10px 16px;border-radius:4px;text-decoration:none">Reset Password</a></p>
  `;

  await sendEmail({ to, subject: "Password Reset Request", html: content });
};

export const sendResetConfirmationEmail = async (to, name) => {
  const content = `<p>Hello <b>${name}</b>,</p><p>Your password has been successfully changed.</p>`;
  await sendEmail({ to, subject: "Password Reset Successful", html: content });
};

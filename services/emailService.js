import nodemailer from "nodemailer";

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

const getSmtpTransporter = () => {
  const emailConfig = resolveEmailConfig();
  if (emailConfig.host && emailConfig.auth?.user && emailConfig.auth?.pass) {
    return nodemailer.createTransport(emailConfig);
  }
  return null;
};

export const verifyEmailTransport = async () => {
  if (process.env.BREVO_API_KEY) {
    return true;
  }

  const transporter = getSmtpTransporter();
  if (transporter) {
    await transporter.verify();
    return true;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Email service is not configured. Set BREVO_API_KEY or valid SMTP credentials.");
  }

  return false;
};

const sendViaBrevoApi = async ({ to, subject, html }) => {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim() || process.env.FROM_EMAIL?.trim() || "contact@makeasite.online";
  const senderName = process.env.BREVO_SENDER_NAME?.trim() || process.env.FROM_NAME?.trim() || "MakeASite";

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "accept": "application/json",
      "api-key": apiKey,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      sender: {
        name: senderName,
        email: senderEmail
      },
      to: [{ email: to }],
      subject,
      htmlContent: messageTemplate(html)
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || `Brevo API error: ${response.statusText}`);
  }

  console.log("Email sent via Brevo API:", data?.messageId || "delivered");
  return { messageId: data?.messageId, provider: "brevo" };
};

export const sendEmail = async ({ to, subject, html }) => {
  // 1. Prioritize Brevo REST API if configured
  if (process.env.BREVO_API_KEY) {
    try {
      return await sendViaBrevoApi({ to, subject, html });
    } catch (error) {
      console.error("Brevo API email sending failed:", error.message);
      // If error occurs in production, rethrow
      if (process.env.NODE_ENV === "production") {
        throw error;
      }
    }
  }

  // 2. Fall back to SMTP transporter if configured
  const transporter = getSmtpTransporter();
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from:
          process.env.EMAIL_FROM ||
          `"${process.env.BREVO_SENDER_NAME || process.env.FROM_NAME || "MakeASite"}" <${process.env.BREVO_SENDER_EMAIL || process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
        to,
        subject,
        html: messageTemplate(html)
      });

      console.log("Email sent via SMTP:", info.messageId);
      return info;
    } catch (error) {
      if (error.code === "EAUTH" || error.responseCode === 535) {
        throw new Error("Email service authentication failed. Update your SMTP credentials or use a valid Brevo SMTP key.");
      }
      throw new Error(error.message || "Unable to send email");
    }
  }

  // 3. In development without credentials: simulate cleanly
  if (process.env.NODE_ENV !== "production") {
    console.log(`[Email Simulation (Dev)] To: ${to} | Subject: ${subject}`);
    return { messageId: `dev-sim-${Date.now()}`, provider: "simulation" };
  }

  // 4. In production without credentials: throw clear exception
  throw new Error("Email service is not configured. Set BREVO_API_KEY or SMTP credentials before sending email.");
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
  <p>Your verification OTP is:</p>
  <h2 style="letter-spacing:4px;color:#dc2626">${otp}</h2>
  <p>This OTP will expire in <b>10 minutes</b>.</p>
  `;

  await sendEmail({ to, subject: "Your Verification OTP", html: content });
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

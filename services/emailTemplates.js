const brandHeader = `
  <div style="padding:28px 32px 22px;background:
    radial-gradient(circle at top right, rgba(249,115,22,0.38), transparent 32%),
    linear-gradient(135deg, #0f172a 0%, #111827 48%, #1f2937 100%);">
    <div style="display:inline-flex;align-items:center;gap:10px;padding:7px 14px;border-radius:999px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.16);font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#f8fafc;">
      MakeASite
    </div>
  </div>
`;

const baseTemplate = ({ eyebrow = "Account Update", title, accent = "#f97316", content }) => `
<div style="margin:0;padding:24px 12px;background:#eef2f7;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:24px;overflow:hidden;box-shadow:0 24px 60px rgba(15,23,42,0.12);">
    ${brandHeader}
    <div style="padding:32px;">
      <div style="display:inline-block;margin-bottom:12px;padding:6px 12px;border-radius:999px;background:${accent}14;color:${accent};font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
        ${eyebrow}
      </div>
      <h1 style="margin:0 0 12px;font-size:28px;line-height:1.15;font-weight:800;letter-spacing:-0.03em;color:#0f172a;">
        ${title}
      </h1>
      ${content}
    </div>
    <div style="padding:18px 32px 26px;background:#f8fafc;border-top:1px solid #e5e7eb;">
      <p style="margin:0;font-size:12px;line-height:1.7;color:#64748b;">
        This email was sent by MakeASite. If you did not request this action, you can safely ignore this message.
      </p>
    </div>
  </div>
</div>
`;

const bodyText = (text) => `
  <p style="margin:0 0 12px;font-size:15px;line-height:1.75;color:#475569;">
    ${text}
  </p>
`;

const otpBlock = (code, accent = "#f97316") => `
  <div style="margin:26px 0;text-align:center;">
    <div style="display:inline-block;padding:18px 28px;border-radius:20px;background:linear-gradient(135deg, ${accent}12, #ffffff);border:1px solid ${accent}33;box-shadow:inset 0 1px 0 rgba(255,255,255,0.7);">
      <div style="font-size:12px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#64748b;margin-bottom:10px;">
        One-Time Code
      </div>
      <div style="font-size:34px;font-weight:800;letter-spacing:10px;color:#0f172a;">
        ${code}
      </div>
    </div>
  </div>
`;

const infoCard = (items) => `
  <div style="margin-top:18px;padding:16px 18px;border-radius:18px;background:#f8fafc;border:1px solid #e5e7eb;">
    ${items
      .map(
        ({ label, value }) => `
          <div style="font-size:13px;line-height:1.7;color:#475569;">
            <span style="font-weight:700;color:#0f172a;">${label}:</span> ${value}
          </div>
        `
      )
      .join("")}
  </div>
`;

export const otpEmailTemplate = (otp) =>
  baseTemplate({
    eyebrow: "Email Verification",
    title: "Confirm your email address",
    accent: "#f97316",
    content: `
      ${bodyText("Use the verification code below to activate your email on MakeASite.")}
      ${otpBlock(otp, "#f97316")}
      ${bodyText("This code stays valid for 10 minutes. Do not share it with anyone.")}
    `
  });

export const loginAlertTemplate = (otp, device) =>
  baseTemplate({
    eyebrow: "Login Security",
    title: "Approve this sign-in request",
    accent: "#2563eb",
    content: `
      ${bodyText("A login attempt was detected for your MakeASite account. Enter the code below to continue securely.")}
      ${otpBlock(otp, "#2563eb")}
      ${infoCard([
        { label: "IP Address", value: device?.ip || "Unknown" },
        { label: "Time", value: new Date().toLocaleString() }
      ])}
    `
  });

export const resetPasswordTemplate = (otp) =>
  baseTemplate({
    eyebrow: "Password Reset",
    title: "Reset your password securely",
    accent: "#dc2626",
    content: `
      ${bodyText("We received a request to reset your password. Use the code below to continue.")}
      ${otpBlock(otp, "#dc2626")}
      ${bodyText("If this was not you, we recommend updating your password and reviewing recent account activity.")}
    `
  });

export const forgotPasswordTemplate = (otp) =>
  baseTemplate({
    eyebrow: "Recovery Code",
    title: "Here is your password reset code",
    accent: "#7c3aed",
    content: `
      ${bodyText("Use this one-time code to recover access to your MakeASite account.")}
      ${otpBlock(otp, "#7c3aed")}
      ${bodyText("The code expires in 10 minutes.")}
    `
  });

export const welcomeEmailTemplate = () =>
  baseTemplate({
    eyebrow: "Welcome",
    title: "Your account is ready",
    accent: "#059669",
    content: `
      ${bodyText("Welcome to MakeASite. Your account has been verified successfully and you can now place orders, manage projects, and stay connected with our team.")}
      <div style="margin-top:24px;">
        <a href="https://makeasite.online/dashboard" style="display:inline-block;padding:13px 22px;border-radius:14px;background:linear-gradient(135deg, #0f172a, #1f2937);color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">
          Open Dashboard
        </a>
      </div>
    `
  });

export const orderCreatedTemplate = (orderTitle) =>
  baseTemplate({
    eyebrow: "Order Received",
    title: "We have received your project order",
    accent: "#059669",
    content: `
      ${bodyText("Your order has been created successfully and our team will review it shortly.")}
      ${infoCard([{ label: "Project", value: orderTitle }])}
    `
  });

export const paymentSuccessTemplate = (amount) =>
  baseTemplate({
    eyebrow: "Payment Success",
    title: "Payment received successfully",
    accent: "#059669",
    content: `
      ${bodyText("Your payment has been processed successfully and your project can move forward without delay.")}
      <div style="margin:26px 0;text-align:center;">
        <div style="display:inline-block;padding:18px 24px;border-radius:18px;background:#ecfdf5;border:1px solid #a7f3d0;">
          <div style="font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#059669;margin-bottom:8px;">
            Amount Paid
          </div>
          <div style="font-size:32px;font-weight:800;color:#065f46;">INR ${amount}</div>
        </div>
      </div>
    `
  });

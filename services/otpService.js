import { isTwilioSmsConfigured } from "./phoneOtpService.js";

const OTP_EXPIRY_MS = 10 * 60 * 1000;

const FIELD_MAP = {
  email: { code: "emailOtpCode", expire: "emailOtpExpire", label: "email verification" },
  phone: { code: "phoneOtpCode", expire: "phoneOtpExpire", label: "phone verification" },
  login: { code: "loginOtpCode", expire: "loginOtpExpire", label: "login" },
  passwordReset: { code: "otpCode", expire: "otpExpire", label: "password reset" }
};

const resolveScope = (scope) => {
  const fields = FIELD_MAP[scope];

  if (!fields) {
    throw new Error(`Unsupported OTP scope: ${scope}`);
  }

  return fields;
};

export const isBrevoConfigured = () => {
  return Boolean(
    process.env.BREVO_API_KEY ||
    (process.env.BREVO_SMTP_USER && (process.env.BREVO_SMTP_PASS || process.env.BREVO_API_KEY)) ||
    (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
  );
};

export const isDevFallbackAllowed = (channel = "email") => {
  // CRITICAL SECURITY RULE: Fallback is NEVER allowed in production
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  // If real phone credentials are provided, disable fallback for phone
  if (channel === "phone") {
    return !isTwilioSmsConfigured();
  }

  // If real email credentials are provided, disable fallback for email
  return !isBrevoConfigured();
};

export const generateOTP = () => String(Math.floor(100000 + Math.random() * 900000));

export const issueOTP = (user, scope = "passwordReset") => {
  const otp = generateOTP();
  const fields = resolveScope(scope);

  user[fields.code] = otp;
  user[fields.expire] = new Date(Date.now() + OTP_EXPIRY_MS);

  return otp;
};

export const verifyOTP = (user, otp, scope = "passwordReset", channel = null) => {
  const effectiveChannel = channel || (scope === "phone" ? "phone" : "email");
  const trimmedOtp = String(otp || "").trim();

  // 1. Development-only fallback check (strictly forbidden in production)
  if (
    isDevFallbackAllowed(effectiveChannel) &&
    (trimmedOtp === "12345" || trimmedOtp === "123456")
  ) {
    const fields = resolveScope(scope);
    user[fields.code] = undefined;
    user[fields.expire] = undefined;
    console.log(`[Auth Dev Fallback] Verified OTP 12345 for ${effectiveChannel} (scope: ${scope})`);
    return true;
  }

  // 2. Standard verification against stored OTP and expiry
  const fields = resolveScope(scope);
  const storedOtp = user[fields.code];
  const storedExpiry = user[fields.expire];

  if (!storedOtp || !storedExpiry) {
    return false;
  }

  if (new Date() > storedExpiry) {
    user[fields.code] = undefined;
    user[fields.expire] = undefined;
    return false;
  }

  if (trimmedOtp !== String(storedOtp).trim()) {
    return false;
  }

  user[fields.code] = undefined;
  user[fields.expire] = undefined;
  return true;
};

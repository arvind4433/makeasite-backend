import rateLimit from "express-rate-limit";

const isProduction = process.env.NODE_ENV === "production";

const createLimiter = ({ windowMs, maxProduction, maxNonProduction, message }) => rateLimit({
  windowMs,
  max: isProduction ? maxProduction : maxNonProduction,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message
  }
});

export const loginLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  maxProduction: 50,
  maxNonProduction: 500,
  message: "Too many login attempts, please try again later"
});

export const otpLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  maxProduction: 60,
  maxNonProduction: 600,
  message: "Too many OTP requests, please try again later"
});

export const passwordResetLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  maxProduction: 20,
  maxNonProduction: 300,
  message: "Too many password reset requests, please try again later"
});

export const oauthLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  maxProduction: 120,
  maxNonProduction: 2000,
  message: "Too many social login attempts, please try again later"
});

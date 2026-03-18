import crypto from "crypto";
import express from "express";
import passport from "passport";

import {
  registerUser,
  loginUser,
  verifyUserOTP,
  verifyContactOTP,
  forgotPassword,
  resetPassword,
  getProfile,
  updateProfile,
  uploadAvatarController,
  resendOTP,
  sendProfileOtp,
  verifyProfileOtp
} from "../controllers/authController.js";

import generateToken from "../utils/generateToken.js";
import asyncHandler from "../utils/asyncHandler.js";
import { protect } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validationMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";
import {
  loginLimiter,
  otpLimiter,
  passwordResetLimiter,
  oauthLimiter
} from "../middleware/rateLimiter.js";
import { upsertOAuthUser } from "../config/passport.js";

import {
  registerSchema,
  loginSchema,
  verifyOtpSchema,
  verifyContactSchema,
  sendProfileOtpSchema,
  verifyProfileOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema
} from "../validation/authValidation.js";

const router = express.Router();

router.post("/register", otpLimiter, validate(registerSchema), asyncHandler(registerUser));
router.post("/login", loginLimiter, validate(loginSchema), asyncHandler(loginUser));
router.post("/verify-otp", otpLimiter, validate(verifyOtpSchema), asyncHandler(verifyUserOTP));
router.post("/verify-contact-otp", otpLimiter, validate(verifyContactSchema), asyncHandler(verifyContactOTP));
router.post("/resend-otp", otpLimiter, validate(forgotPasswordSchema), asyncHandler(resendOTP));
router.post("/forgot-password", passwordResetLimiter, validate(forgotPasswordSchema), asyncHandler(forgotPassword));
router.post("/reset-password", passwordResetLimiter, validate(resetPasswordSchema), asyncHandler(resetPassword));
router.get("/profile", protect, asyncHandler(getProfile));
router.put("/profile", protect, asyncHandler(updateProfile));
router.post("/profile/send-otp", protect, otpLimiter, validate(sendProfileOtpSchema), asyncHandler(sendProfileOtp));
router.post("/profile/verify-otp", protect, otpLimiter, validate(verifyProfileOtpSchema), asyncHandler(verifyProfileOtp));
router.post("/profile/avatar", protect, upload.single("avatar"), asyncHandler(uploadAvatarController));

router.get(
  "/google",
  oauthLimiter,
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
    prompt: "consent select_account"
  })
);

router.get(
  "/google/callback",
  oauthLimiter,
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}/login`
  }),
  (req, res) => {
    const token = generateToken(req.user._id);
    res.redirect(`${process.env.FRONTEND_URL}/social-auth?token=${token}&provider=google`);
  }
);

router.get(
  "/linkedin",
  oauthLimiter,
  asyncHandler(async (req, res) => {
    if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET || !process.env.LINKEDIN_CALLBACK_URL) {
      return res.redirect(`${process.env.FRONTEND_URL}/social-auth?error=linkedin_not_configured&provider=linkedin`);
    }

    const state = crypto.randomBytes(16).toString("hex");
    const params = new URLSearchParams({
      response_type: "code",
      client_id: process.env.LINKEDIN_CLIENT_ID,
      redirect_uri: process.env.LINKEDIN_CALLBACK_URL,
      scope: "openid profile email",
      state
    });

    res.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`);
  })
);

router.get(
  "/linkedin/callback",
  oauthLimiter,
  asyncHandler(async (req, res) => {
    const { code, error } = req.query;

    if (error || !code) {
      return res.redirect(`${process.env.FRONTEND_URL}/social-auth?error=linkedin_login_failed&provider=linkedin`);
    }

    if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET || !process.env.LINKEDIN_CALLBACK_URL) {
      return res.redirect(`${process.env.FRONTEND_URL}/social-auth?error=linkedin_not_configured&provider=linkedin`);
    }

    try {
      const tokenResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: String(code),
          redirect_uri: process.env.LINKEDIN_CALLBACK_URL,
          client_id: process.env.LINKEDIN_CLIENT_ID,
          client_secret: process.env.LINKEDIN_CLIENT_SECRET
        })
      });

      if (!tokenResponse.ok) {
        throw new Error("Unable to exchange LinkedIn token");
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      const profileResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (!profileResponse.ok) {
        throw new Error("Unable to load LinkedIn profile");
      }

      const profile = await profileResponse.json();
      const user = await upsertOAuthUser({
        provider: "linkedin",
        providerId: profile.sub,
        name: profile.name || `${profile.given_name || ""} ${profile.family_name || ""}`.trim(),
        email: profile.email,
        avatar: profile.picture
      });

      const token = generateToken(user._id);
      res.redirect(`${process.env.FRONTEND_URL}/social-auth?token=${token}&provider=linkedin`);
    } catch {
      res.redirect(`${process.env.FRONTEND_URL}/social-auth?error=linkedin_login_failed&provider=linkedin`);
    }
  })
);

router.get(
  "/facebook",
  oauthLimiter,
  passport.authenticate("facebook", {
    scope: ["email"],
    session: false
  })
);

router.get(
  "/facebook/callback",
  oauthLimiter,
  passport.authenticate("facebook", {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}/login`
  }),
  (req, res) => {
    const token = generateToken(req.user._id);
    res.redirect(`${process.env.FRONTEND_URL}/social-auth?token=${token}&provider=facebook`);
  }
);

router.post("/logout", protect, (req, res) => {
  res.json({
    message: "Logged out successfully"
  });
});

export default router;

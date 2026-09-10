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
  verifyProfileOtp,
  googleCredentialLogin
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

import { requireDB } from "../middleware/dbMiddleware.js";

const router = express.Router();

router.use(requireDB);

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
  (req, res, next) => {
    const frontendUrl = process.env.FRONTEND_URL || (process.env.NODE_ENV === "production" ? "https://www.makeasite.online" : "http://localhost:5173");
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.redirect(`${frontendUrl}/social-auth?error=google_not_configured&provider=google`);
    }

    passport.authenticate("google", {
      scope: ["profile", "email"],
      session: false,
      prompt: "consent select_account"
    })(req, res, next);
  }
);

router.get(
  "/google/callback",
  oauthLimiter,
  (req, res, next) => {
    const frontendUrl = process.env.FRONTEND_URL || (process.env.NODE_ENV === "production" ? "https://www.makeasite.online" : "http://localhost:5173");
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.redirect(`${frontendUrl}/social-auth?error=google_not_configured&provider=google`);
    }

    passport.authenticate("google", {
      session: false,
      failureRedirect: `${frontendUrl}/social-auth?error=google_login_failed&provider=google`
    }, (err, user) => {
      if (err || !user) {
        return res.redirect(`${frontendUrl}/social-auth?error=google_login_failed&provider=google`);
      }
      const token = generateToken(user._id);
      return res.redirect(`${frontendUrl}/social-auth?token=${token}&provider=google`);
    })(req, res, next);
  }
);

router.post("/google", oauthLimiter, asyncHandler(googleCredentialLogin));

router.get(
  "/linkedin",
  oauthLimiter,
  asyncHandler(async (req, res) => {
    const frontendUrl = process.env.FRONTEND_URL || (process.env.NODE_ENV === "production" ? "https://www.makeasite.online" : "http://localhost:5173");
    if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET) {
      return res.redirect(`${frontendUrl}/social-auth?error=linkedin_not_configured&provider=linkedin`);
    }

    const callbackURL = process.env.LINKEDIN_CALLBACK_URL ||
      `${process.env.BACKEND_URL || (process.env.NODE_ENV === "production" ? "https://www.makeasite.online" : "http://localhost:5000")}/api/auth/linkedin/callback`;

    const state = crypto.randomBytes(16).toString("hex");
    const params = new URLSearchParams({
      response_type: "code",
      client_id: process.env.LINKEDIN_CLIENT_ID,
      redirect_uri: callbackURL,
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
    const frontendUrl = process.env.FRONTEND_URL || (process.env.NODE_ENV === "production" ? "https://www.makeasite.online" : "http://localhost:5173");
    const { code, error } = req.query;

    if (error || !code) {
      return res.redirect(`${frontendUrl}/social-auth?error=linkedin_login_failed&provider=linkedin`);
    }

    if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET) {
      return res.redirect(`${frontendUrl}/social-auth?error=linkedin_not_configured&provider=linkedin`);
    }

    const callbackURL = process.env.LINKEDIN_CALLBACK_URL ||
      `${process.env.BACKEND_URL || (process.env.NODE_ENV === "production" ? "https://www.makeasite.online" : "http://localhost:5000")}/api/auth/linkedin/callback`;

    try {
      const tokenResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: String(code),
          redirect_uri: callbackURL,
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
      res.redirect(`${frontendUrl}/social-auth?token=${token}&provider=linkedin`);
    } catch {
      res.redirect(`${frontendUrl}/social-auth?error=linkedin_login_failed&provider=linkedin`);
    }
  })
);

router.get(
  "/facebook",
  oauthLimiter,
  (req, res, next) => {
    const frontendUrl = process.env.FRONTEND_URL || (process.env.NODE_ENV === "production" ? "https://www.makeasite.online" : "http://localhost:5173");
    if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET) {
      return res.redirect(`${frontendUrl}/social-auth?error=facebook_not_configured&provider=facebook`);
    }

    passport.authenticate("facebook", {
      scope: ["email"],
      session: false
    })(req, res, next);
  }
);

router.get(
  "/facebook/callback",
  oauthLimiter,
  (req, res, next) => {
    const frontendUrl = process.env.FRONTEND_URL || (process.env.NODE_ENV === "production" ? "https://www.makeasite.online" : "http://localhost:5173");
    if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET) {
      return res.redirect(`${frontendUrl}/social-auth?error=facebook_not_configured&provider=facebook`);
    }

    passport.authenticate("facebook", {
      session: false,
      failureRedirect: `${frontendUrl}/social-auth?error=facebook_login_failed&provider=facebook`
    }, (err, user) => {
      if (err || !user) {
        return res.redirect(`${frontendUrl}/social-auth?error=facebook_login_failed&provider=facebook`);
      }
      const token = generateToken(user._id);
      return res.redirect(`${frontendUrl}/social-auth?token=${token}&provider=facebook`);
    })(req, res, next);
  }
);

router.post("/logout", protect, (req, res) => {
  res.json({
    message: "Logged out successfully"
  });
});

export default router;

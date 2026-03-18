import bcrypt from "bcryptjs";
import fs from "fs/promises";
import User from "../models/User.js";
import generateToken from "../utils/generateToken.js";
import { getUserDeviceInfo } from "../utils/ipTracker.js";
import { issueOTP, verifyOTP } from "../services/otpService.js";
import { sendEmail } from "../services/emailService.js";
import { sendPhoneOtp } from "../services/phoneOtpService.js";
import cloudinary from "../config/cloudinary.js";
import {
  otpEmailTemplate,
  forgotPasswordTemplate,
  resetPasswordTemplate,
  welcomeEmailTemplate,
  loginAlertTemplate
} from "../services/emailTemplates.js";

const normalizeEmail = (email) => email?.trim().toLowerCase();
const normalizePhone = (phone) => phone?.trim().replace(/\D/g, "");
const isDevelopment = process.env.NODE_ENV !== "production";

const profilePayload = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  avatar: user.avatar,
  role: user.role,
  isVerified: Boolean(user.emailVerified || user.phoneVerified || user.isVerified),
  emailVerified: Boolean(user.emailVerified || user.isVerified),
  phoneVerified: Boolean(user.phoneVerified),
  preferences: {
    notificationsEnabled: user.preferences?.notificationsEnabled ?? true
  },
  lastLoginAt: user.lastLoginAt || null,
  lastLoginIP: user.lastLoginIP || null
});

const toUserPayload = (user, token) => ({
  ...profilePayload(user),
  token
});

const getDuplicateFieldMessage = (field) => {
  if (field === "email") return "Email already registered";
  if (field === "phone") return "Phone number already registered";
  if (field === "username") return "Username is no longer required. Please try again.";
  return "Duplicate value already exists";
};

const handleDuplicateUserError = (error, res) => {
  if (error?.code !== 11000) {
    throw error;
  }

  const duplicateField = Object.keys(error.keyPattern || error.keyValue || {})[0];
  return res.status(400).json({
    message: getDuplicateFieldMessage(duplicateField)
  });
};

const createDebugOtpPayload = (values) => {
  if (!isDevelopment) {
    return undefined;
  }

  return values;
};

const sendEmailVerificationOtp = async (user) => {
  const otp = issueOTP(user, "email");

  await sendEmail({
    to: user.email,
    subject: "Verify your email",
    html: otpEmailTemplate(otp)
  });

  return otp;
};

const sendPhoneVerificationOtp = async (user) => {
  const otp = issueOTP(user, "phone");
  await sendPhoneOtp({ phone: user.phone, otp, context: "register" });
  return otp;
};

const sendLoginOtp = async (user, channel, device) => {
  const otp = issueOTP(user, "login");
  const target = channel === "email" ? user.email : user.phone;

  user.loginOtpChannel = channel;
  user.loginOtpTarget = target;

  if (channel === "email") {
    await sendEmail({
      to: user.email,
      subject: "Login Verification",
      html: loginAlertTemplate(otp, device)
    });
  } else {
    await sendPhoneOtp({ phone: user.phone, otp, context: "login" });
  }

  return otp;
};

const sendProfileVerificationOtp = async (user, channel) => {
  if (channel === "email") {
    const otp = await sendEmailVerificationOtp(user);
    return { otp, target: user.email };
  }

  const otp = await sendPhoneVerificationOtp(user);
  return { otp, target: user.phone };
};

const findUserByIdentifier = ({ email, phone }) => {
  if (email) {
    return User.findOne({ email });
  }

  return User.findOne({ phone });
};

const finalizeVerificationFlags = (user) => {
  user.emailVerified = Boolean(user.emailVerified || user.isVerified);
  user.phoneVerified = Boolean(user.phoneVerified);
  user.isVerified = Boolean(user.emailVerified);
};

export const registerUser = async (req, res) => {
  const name = req.body.name?.trim();
  const email = normalizeEmail(req.body.email);
  const phone = normalizePhone(req.body.phone);
  const password = req.body.password;

  const matches = await User.find({
    $or: [
      ...(email ? [{ email }] : []),
      ...(phone ? [{ phone }] : [])
    ]
  });

  const exactMatch = matches.find((user) => user.email === email && user.phone === phone && user.provider === "local");
  const otherEmailUser = matches.find((user) => user.email === email && String(user._id) !== String(exactMatch?._id));
  const otherPhoneUser = matches.find((user) => user.phone === phone && String(user._id) !== String(exactMatch?._id));

  if (otherEmailUser) {
    return res.status(400).json({ message: "Email already registered" });
  }

  if (otherPhoneUser) {
    return res.status(400).json({ message: "Phone number already registered" });
  }

  if (exactMatch?.emailVerified && exactMatch?.phoneVerified) {
    return res.status(400).json({ message: "Email already registered" });
  }

  const user = exactMatch || new User({
    name,
    email,
    phone,
    provider: "local"
  });

  user.name = name;
  user.email = email;
  user.phone = phone;
  user.password = await bcrypt.hash(password, 10);
  finalizeVerificationFlags(user);

  const debugOtps = {};

  if (!user.emailVerified && user.email) {
    debugOtps.email = await sendEmailVerificationOtp(user);
  }

  if (!user.phoneVerified && user.phone) {
    debugOtps.phone = await sendPhoneVerificationOtp(user);
  }

  await user.save();

  return res.status(exactMatch ? 200 : 201).json({
    message: "Verification OTPs sent",
    email: user.email,
    phone: user.phone,
    emailVerified: user.emailVerified,
    phoneVerified: user.phoneVerified,
    verificationRequired: {
      email: !user.emailVerified,
      phone: !user.phoneVerified
    },
    debugOtps: createDebugOtpPayload(debugOtps)
  });
};

export const verifyUserOTP = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const phone = normalizePhone(req.body.phone);
  const { otp } = req.body;
  const channel = email ? "email" : "phone";
  const identifier = email || phone;

  const user = await findUserByIdentifier({ email, phone });

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  if (user.loginOtpChannel !== channel || user.loginOtpTarget !== identifier) {
    return res.status(400).json({ message: "Please request a fresh login OTP" });
  }

  const valid = verifyOTP(user, otp, "login");

  if (!valid) {
    return res.status(400).json({ message: "Invalid OTP" });
  }

  user.loginOtpChannel = undefined;
  user.loginOtpTarget = undefined;

  const device = getUserDeviceInfo(req);
  user.lastLoginIP = device.ip;
  user.lastLoginAt = new Date();
  await user.save();

  const token = generateToken(user._id);
  return res.json(toUserPayload(user, token));
};

export const verifyContactOTP = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const phone = normalizePhone(req.body.phone);
  const { otp, channel } = req.body;
  const user = await findUserByIdentifier({ email, phone });

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const valid = verifyOTP(user, otp, channel);

  if (!valid) {
    return res.status(400).json({ message: "Invalid OTP" });
  }

  if (channel === "email") {
    user.emailVerified = true;
    user.isVerified = true;

    try {
      await sendEmail({
        to: user.email,
        subject: "Welcome to MakeASite",
        html: welcomeEmailTemplate()
      });
    } catch (error) {
      console.warn(`Welcome email skipped: ${error.message}`);
    }
  }

  if (channel === "phone") {
    user.phoneVerified = true;
  }

  await user.save();

  const registrationComplete = Boolean(user.emailVerified && user.phoneVerified);
  const token = registrationComplete ? generateToken(user._id) : null;

  return res.json({
    message: channel === "email" ? "Email verified successfully" : "Phone verified successfully",
    emailVerified: user.emailVerified,
    phoneVerified: user.phoneVerified,
    completedRegistration: registrationComplete,
    ...(registrationComplete ? { user: toUserPayload(user, token) } : {})
  });
};

export const sendProfileOtp = async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const { channel } = req.body;
  const target = channel === "email" ? user.email : user.phone;

  if (!target) {
    return res.status(400).json({ message: channel === "email" ? "Email is required before verification" : "Phone number is required before verification" });
  }

  const { otp } = await sendProfileVerificationOtp(user, channel);
  await user.save();

  return res.json({
    message: `${channel === "email" ? "Email" : "Phone"} OTP sent`,
    channel,
    target,
    debugOtp: createDebugOtpPayload(otp)
  });
};

export const verifyProfileOtp = async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const { channel, otp } = req.body;
  const valid = verifyOTP(user, otp, channel);

  if (!valid) {
    return res.status(400).json({ message: "Invalid OTP" });
  }

  if (channel === "email") {
    user.emailVerified = true;
    user.isVerified = true;
  } else {
    user.phoneVerified = true;
  }

  await user.save();

  return res.json({
    message: `${channel === "email" ? "Email" : "Phone"} verified successfully`,
    user: profilePayload(user)
  });
};

export const loginUser = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const phone = normalizePhone(req.body.phone);
  const { password } = req.body;
  const channel = email ? "email" : "phone";

  const user = await findUserByIdentifier({ email, phone }).select("+password");

  if (!user) {
    return res.status(400).json({ message: "Account not found" });
  }

  if (!user.password) {
    return res.status(400).json({ message: "Password is not set for this account. Please reset your password first." });
  }

  const passwordMatches = await bcrypt.compare(password, user.password);

  if (!passwordMatches) {
    return res.status(400).json({ message: "Invalid password" });
  }

  if (channel === "email" && !user.emailVerified) {
    return res.status(403).json({ message: "Email not verified. Please complete email verification first." });
  }

  if (channel === "phone" && !user.phoneVerified) {
    return res.status(403).json({ message: "Phone not verified. Please verify phone from your profile or login using email." });
  }

  const device = getUserDeviceInfo(req);
  const otp = await sendLoginOtp(user, channel, device);
  await user.save();

  return res.json({
    message: `OTP sent to your ${channel}`,
    email: user.email,
    phone: user.phone,
    channel,
    identifier: channel === "email" ? user.email : user.phone,
    debugOtp: createDebugOtpPayload(otp)
  });
};

export const forgotPassword = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const user = await User.findOne({ email }).select("+password");

  if (!user || !user.password) {
    return res.status(404).json({ message: "User not found" });
  }

  const otp = issueOTP(user, "passwordReset");
  await user.save();

  await sendEmail({
    to: user.email,
    subject: "Password Recovery Code",
    html: forgotPasswordTemplate(otp)
  });

  return res.json({ message: "Reset OTP sent to email" });
};

export const resetPassword = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { otp, password } = req.body;
  const user = await User.findOne({ email }).select("+password");

  if (!user || !user.password) {
    return res.status(404).json({ message: "User not found" });
  }

  const valid = verifyOTP(user, otp, "passwordReset");

  if (!valid) {
    return res.status(400).json({ message: "Invalid OTP" });
  }

  user.password = await bcrypt.hash(password, 10);
  await user.save();

  return res.json({ message: "Password reset successful" });
};

export const resendOTP = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const user = await User.findOne({ email });

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const otp = await sendEmailVerificationOtp(user);
  await user.save();

  return res.json({
    message: "New OTP sent to email",
    debugOtp: createDebugOtpPayload(otp)
  });
};

export const getProfile = async (req, res) => {
  const user = await User.findById(req.user._id);
  return res.json(toUserPayload(user, req.headers.authorization?.split(" ")[1]));
};

export const updateProfile = async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  if (req.body.name) {
    user.name = req.body.name.trim();
  }

  if (typeof req.body.notificationsEnabled === "boolean") {
    user.preferences = user.preferences || {};
    user.preferences.notificationsEnabled = req.body.notificationsEnabled;
  }

  if (typeof req.body.email === "string" && normalizeEmail(req.body.email) !== normalizeEmail(user.email)) {
    const email = normalizeEmail(req.body.email);
    const existingEmailUser = await User.findOne({
      email,
      _id: { $ne: user._id }
    });

    if (existingEmailUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    user.email = email;
    user.emailVerified = false;
    user.isVerified = false;
  }

  if (typeof req.body.phone === "string" && normalizePhone(req.body.phone) !== normalizePhone(user.phone)) {
    const phone = normalizePhone(req.body.phone);
    const existingPhoneUser = await User.findOne({
      phone,
      _id: { $ne: user._id }
    });

    if (existingPhoneUser) {
      return res.status(400).json({ message: "Phone number already registered" });
    }

    user.phone = phone;
    user.phoneVerified = false;
  }

  await user.save();

  return res.json(toUserPayload(user, req.headers.authorization?.split(" ")[1]));
};

export const uploadAvatarController = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  if (!req.file.mimetype?.startsWith("image/")) {
    return res.status(400).json({ message: "Please upload an image file only" });
  }

  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  if (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  ) {
    const uploaded = await cloudinary.uploader.upload(req.file.path, {
      folder: "makeasite/avatars",
      public_id: `user-${user._id}-${Date.now()}`,
      resource_type: "image"
    });

    user.avatar = uploaded.secure_url;

    try {
      await fs.unlink(req.file.path);
    } catch {
      // ignore local cleanup failure
    }
  } else {
    user.avatar = `/uploads/${req.file.filename}`;
  }

  await user.save();

  return res.json({
    avatar: user.avatar,
    message: "Avatar updated successfully"
  });
};

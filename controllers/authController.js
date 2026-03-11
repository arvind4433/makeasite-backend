const User = require('../models/User');
const jwt = require('jsonwebtoken');
const sendEmail = require('../utils/sendEmail');
const useragent = require('express-useragent');
const requestIp = require('request-ip');
const { generateOTP } = require('../utils/otpService');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
    try {
        const { name, email, password, country } = req.body;

        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Generate OTP for email verification
        const otp = generateOTP();
        const user = await User.create({
            name, email, password, country,
            otp,
            otpExpires: new Date(Date.now() + 10 * 60 * 1000),
        });

        // Send OTP email
        try {
            await sendEmail({
                email: user.email,
                subject: 'Verify your WebDevPro account',
                html: `
                    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;border-radius:12px;background:#0f172a;color:#f1f5f9">
                        <h2 style="color:#ef4444;margin-bottom:8px">Welcome to WebDevPro!</h2>
                        <p style="color:#94a3b8;margin-bottom:24px">Hi ${user.name}, please verify your email address to get started.</p>
                        <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px">
                            <p style="color:#94a3b8;font-size:13px;margin:0 0 8px">Your one-time verification code</p>
                            <div style="font-size:36px;font-weight:900;letter-spacing:12px;color:#ef4444">${otp}</div>
                            <p style="color:#64748b;font-size:12px;margin:12px 0 0">Valid for 10 minutes</p>
                        </div>
                        <p style="color:#64748b;font-size:12px">If you did not request this, you can safely ignore this email.</p>
                    </div>`,
            });
        } catch (emailErr) {
            console.error('Registration OTP email failed:', emailErr.message);
        }

        res.status(201).json({ message: 'Registration successful. OTP sent to your email.', email: user.email });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Step 1 of login — validate credentials, send OTP
// @route   POST /api/auth/login
// @access  Public
const authUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user || !(await user.matchPassword(password))) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Generate OTP
        const otp = generateOTP();
        user.otp = otp;
        user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
        await user.save();

        // Send OTP email  
        try {
            await sendEmail({
                email: user.email,
                subject: 'Your WebDevPro Login Code',
                html: `
                    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;border-radius:12px;background:#0f172a;color:#f1f5f9">
                        <h2 style="color:#ef4444;margin-bottom:8px">Sign-in verification</h2>
                        <p style="color:#94a3b8;margin-bottom:24px">Hi ${user.name}, enter the code below to complete sign-in.</p>
                        <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px">
                            <p style="color:#94a3b8;font-size:13px;margin:0 0 8px">Your one-time login code</p>
                            <div style="font-size:36px;font-weight:900;letter-spacing:12px;color:#ef4444">${otp}</div>
                            <p style="color:#64748b;font-size:12px;margin:12px 0 0">Valid for 10 minutes</p>
                        </div>
                        <p style="color:#64748b;font-size:12px">If you didn't attempt to sign in, please change your password immediately.</p>
                    </div>`,
            });
        } catch (emailErr) {
            console.error('Login OTP email failed:', emailErr.message);
            // Still return success — OTP is logged in the console via generateOTP()
        }

        res.json({ message: 'OTP sent to your email. Please verify to complete login.', email: user.email });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Step 2 of login — verify OTP, return token
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (!user.otp || !user.otpExpires) {
            return res.status(400).json({ message: 'No OTP requested for this account' });
        }

        if (user.otpExpires < Date.now()) {
            return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
        }

        if (user.otp !== otp) {
            return res.status(400).json({ message: 'Invalid OTP. Please try again.' });
        }

        // Clear OTP
        user.otp = undefined;
        user.otpExpires = undefined;
        user.isVerified = true;
        await user.save();

        // Send security alert (fire-and-forget)
        try {
            const uaStr = req.headers['user-agent'] || '';
            const ua = useragent.parse(uaStr);
            const ip = requestIp.getClientIp(req);
            await sendEmail({
                email: user.email,
                subject: 'Security Alert: New Sign-in Detected',
                html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;border-radius:12px;background:#0f172a;color:#f1f5f9">
                    <h2 style="color:#ef4444">New Sign-in Detected</h2>
                    <p style="color:#94a3b8">Hi ${user.name}, a new sign-in was completed on your account.</p>
                    <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:16px;margin:16px 0">
                        <p style="margin:4px 0;color:#94a3b8;font-size:13px">🌐 IP: ${ip}</p>
                        <p style="margin:4px 0;color:#94a3b8;font-size:13px">💻 Device: ${ua.isDesktop ? 'Desktop' : ua.isMobile ? 'Mobile' : 'Unknown'}</p>
                        <p style="margin:4px 0;color:#94a3b8;font-size:13px">🕐 Time: ${new Date().toLocaleString()}</p>
                    </div>
                    <p style="color:#64748b;font-size:12px">If this wasn't you, please change your password immediately.</p>
                </div>`,
            });
        } catch (_) { }

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            avatar: user.avatar || '',
            role: user.role,
            token: generateToken(user._id),
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (user) {
            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                country: user.country,
                role: user.role,
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Forgot Password — send OTP
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.json({ message: 'If that email exists, a reset code has been sent.' });
        }

        const otp = generateOTP();
        user.otp = otp;
        user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
        await user.save();

        try {
            await sendEmail({
                email: user.email,
                subject: 'Password Reset Code — WebDevPro',
                html: `
                    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;border-radius:12px;background:#0f172a;color:#f1f5f9">
                        <h2 style="color:#ef4444;margin-bottom:8px">Password Reset</h2>
                        <p style="color:#94a3b8;margin-bottom:24px">Hi ${user.name}, use the code below to reset your password.</p>
                        <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px">
                            <p style="color:#94a3b8;font-size:13px;margin:0 0 8px">Your reset code</p>
                            <div style="font-size:36px;font-weight:900;letter-spacing:12px;color:#ef4444">${otp}</div>
                            <p style="color:#64748b;font-size:12px;margin:12px 0 0">Valid for 10 minutes</p>
                        </div>
                    </div>`,
            });
        } catch (emailErr) {
            console.error('Forgot password email failed:', emailErr.message);
        }

        res.json({ message: 'If that email exists, a reset code has been sent.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Reset Password using OTP
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!user.otp || !user.otpExpires) {
            return res.status(400).json({ message: 'No reset code requested for this account' });
        }

        if (user.otpExpires < Date.now()) {
            return res.status(400).json({ message: 'Reset code has expired. Please request a new one.' });
        }

        if (user.otp !== otp) {
            return res.status(400).json({ message: 'Invalid reset code' });
        }

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ message: 'New password must be at least 6 characters' });
        }

        user.password = newPassword;
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        res.json({ message: 'Password has been reset successfully. You can now log in.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { registerUser, authUser, getUserProfile, verifyOTP, forgotPassword, resetPassword };

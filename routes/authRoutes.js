const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const router = express.Router();

const { protect } = require('../middleware/authMiddleware');

const {
    registerUser,
    authUser,
    getUserProfile,
    verifyOTP,
    forgotPassword,
    resetPassword
} = require('../controllers/authController');

const FRONTEND = process.env.FRONTEND_URL || "https://makeasite.online";


/* ───────── RATE LIMITER ───────── */

const authLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 30,
    message: { message: "Too many requests, please try again later" }
});


/* ───────── TOKEN HELPER ───────── */

const generateToken = (id) =>
    jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || "30d"
    });


/* ───────── OAUTH SUCCESS ───────── */

const oauthSuccessRedirect = (req, res) => {

    try {

        const user = req.user;

        const token = generateToken(user._id);

        const data = encodeURIComponent(JSON.stringify({
            _id: user._id,
            name: user.name,
            email: user.email,
            avatar: user.avatar || "",
            provider: user.provider,
            role: user.role,
            token
        }));

        res.redirect(`${FRONTEND}/auth/callback?data=${data}`);
        
    } catch (error) {

        res.redirect(`${FRONTEND}/auth/callback?error=oauth_failed`);

    }
};


/* ───────── EMAIL/PASSWORD AUTH ───────── */

router.post("/register", authLimiter, registerUser);

router.post("/login", authLimiter, authUser);

router.post("/verify-otp", authLimiter, verifyOTP);

router.post("/forgot-password", authLimiter, forgotPassword);

router.post("/reset-password", authLimiter, resetPassword);


/* ───────── GOOGLE LOGIN ───────── */

router.get(
    "/google",
    passport.authenticate("google", {
        scope: ["profile", "email"],
        session: false,
        prompt: "select_account"
    })
);

router.get(
    "/google/callback",
    passport.authenticate("google", {
        session: false,
        failureRedirect: `${FRONTEND}/auth/callback?error=google_failed`
    }),
    oauthSuccessRedirect
);


/* ───────── FACEBOOK LOGIN ───────── */

router.get(
    "/facebook",
    passport.authenticate("facebook", {
        scope: ["email", "public_profile"],
        session: false
    })
);

router.get(
    "/facebook/callback",
    passport.authenticate("facebook", {
        session: false,
        failureRedirect: `${FRONTEND}/auth/callback?error=facebook_failed`
    }),
    oauthSuccessRedirect
);


/* ───────── TEST EMAIL (Admin / Debug) ───────── */
// GET /api/auth/test-email?to=email@example.com
// Used to verify email delivery is working on the live server.
router.get('/test-email', async (req, res) => {
    const to = req.query.to;
    if (!to) return res.status(400).json({ message: 'Provide ?to=email@example.com' });
    try {
        const sendEmail = require('../utils/sendEmail');
        await sendEmail({
            email: to,
            subject: 'MakeASite — Email Delivery Test ✅',
            html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;border-radius:12px;background:#0f172a;color:#f1f5f9">
                <h2 style="color:#ef4444;margin-bottom:8px">Email Delivery Working!</h2>
                <p style="color:#94a3b8">This is a test email from <strong>MakeASite</strong>.</p>
                <p style="color:#94a3b8">If you received this, your email configuration is correctly set up.</p>
                <p style="color:#64748b;font-size:12px;margin-top:24px">Sent at: ${new Date().toLocaleString()}</p>
            </div>`,
        });
        res.json({ message: `Test email sent to ${to}. Check your inbox.` });
    } catch (err) {
        res.status(500).json({ message: 'Email send failed: ' + err.message });
    }
});


/* ───────── PROTECTED ROUTE ───────── */

router.get("/profile", protect, getUserProfile);


module.exports = router;
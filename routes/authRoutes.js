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


/* ───────── PROTECTED ROUTE ───────── */

router.get("/profile", protect, getUserProfile);


module.exports = router;
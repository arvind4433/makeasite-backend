const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (id) =>
    jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '30d' });

/* ─── Shared response shape ───────────────────────── */
const userPayload = (user, token) => ({
    _id: user._id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    provider: user.provider,
    role: user.role,
    token,
});

/* ─────────────────────────────────────────────────────
   GOOGLE — verify credential from @react-oauth/google
   POST /api/auth/google
   Body: { credential }  (the JWT id_token from Google)
   ───────────────────────────────────────────────────── */
const googleAuth = async (req, res) => {
    try {
        const { credential } = req.body;
        if (!credential) return res.status(400).json({ message: 'No Google credential provided' });

        // Verify the Google ID token
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const { sub: googleId, email, name, picture } = payload;

        if (!email) return res.status(400).json({ message: 'No email returned from Google' });

        // Find or create user
        let user = await User.findOne({ email });

        if (user) {
            // Existing user — update provider info if needed
            if (user.provider === 'local') {
                // Allow local users to also link Google
                user.provider = 'google';
                user.providerId = googleId;
                if (!user.avatar && picture) user.avatar = picture;
                await user.save();
            }
        } else {
            // New user from Google — create account
            user = await User.create({
                name,
                email,
                avatar: picture || '',
                provider: 'google',
                providerId: googleId,
                isVerified: true, // Google already verified the email
                password: null,
                country: '',
            });
        }

        res.json(userPayload(user, generateToken(user._id)));

    } catch (err) {
        console.error('Google auth error:', err.message);
        res.status(401).json({ message: 'Google authentication failed. Please try again.' });
    }
};

/* ─────────────────────────────────────────────────────
   FACEBOOK — stub ready for when FB env vars are added
   POST /api/auth/facebook
   Body: { accessToken, userID }
   ───────────────────────────────────────────────────── */
const facebookAuth = async (req, res) => {
    try {
        const { accessToken, userID } = req.body;
        if (!accessToken || !userID) {
            return res.status(400).json({ message: 'Missing Facebook credentials' });
        }

        // Check that Facebook env vars are configured
        if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET) {
            return res.status(501).json({ message: 'Facebook authentication is not yet configured on this server.' });
        }

        // Verify user token against Facebook Graph API
        const verifyUrl = `https://graph.facebook.com/debug_token?input_token=${accessToken}&access_token=${process.env.FACEBOOK_APP_ID}|${process.env.FACEBOOK_APP_SECRET}`;
        const verifyRes = await fetch(verifyUrl);
        const verifyData = await verifyRes.json();

        if (!verifyData.data?.is_valid || verifyData.data?.user_id !== userID) {
            return res.status(401).json({ message: 'Invalid Facebook token' });
        }

        // Get user info from Facebook
        const profileUrl = `https://graph.facebook.com/${userID}?fields=id,name,email,picture.type(large)&access_token=${accessToken}`;
        const profileRes = await fetch(profileUrl);
        const profile = await profileRes.json();

        const { id: fbId, name, email, picture } = profile;
        const avatar = picture?.data?.url || '';

        // Find or create user
        let user = await User.findOne(email ? { email } : { provider: 'facebook', providerId: fbId });

        if (user) {
            if (!user.providerId) { user.providerId = fbId; await user.save(); }
        } else {
            if (!email) return res.status(400).json({ message: 'No email returned from Facebook. Please grant email permission.' });
            user = await User.create({
                name,
                email,
                avatar,
                provider: 'facebook',
                providerId: fbId,
                isVerified: true,
                password: null,
                country: '',
            });
        }

        res.json(userPayload(user, generateToken(user._id)));

    } catch (err) {
        console.error('Facebook auth error:', err.message);
        res.status(401).json({ message: 'Facebook authentication failed. Please try again.' });
    }
};

module.exports = { googleAuth, facebookAuth };

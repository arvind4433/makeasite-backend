const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const User = require('../models/User');

/* ── Google Strategy ──────────────────────────────────── */

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.error([
        '❌  GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is not set!',
        '   Google login will fail at runtime.',
        '   → Set these on Render: Dashboard → Environment → Add Variable',
    ].join('\n'));
}

passport.use(new GoogleStrategy(
    {
        clientID:     process.env.GOOGLE_CLIENT_ID     || 'MISSING_CLIENT_ID',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'MISSING_CLIENT_SECRET',
        callbackURL:  process.env.GOOGLE_CALLBACK_URL  || 'https://makeasite-api.onrender.com/api/auth/google/callback',
        scope: ['profile', 'email'],
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            const email  = profile.emails?.[0]?.value;
            const avatar = profile.photos?.[0]?.value || '';
            const name   = profile.displayName || 'Google User';

            if (!email) return done(new Error('No email returned from Google profile'), null);

            let user = await User.findOne({
                $or: [{ email }, { provider: 'google', providerId: profile.id }]
            });

            if (user) {
                let changed = false;
                if (!user.providerId)       { user.providerId = profile.id; changed = true; }
                if (!user.avatar && avatar) { user.avatar     = avatar;     changed = true; }
                if (!user.isVerified)       { user.isVerified = true;        changed = true; }
                if (changed) await user.save();
            } else {
                user = await User.create({
                    name, email, avatar,
                    provider: 'google',
                    providerId: profile.id,
                    isVerified: true,
                    password: null,
                    country: '',
                });
            }

            return done(null, user);
        } catch (err) {
            return done(err, null);
        }
    }
));


/* ── Facebook Strategy (activates when env vars are set) ── */
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {

    passport.use(new FacebookStrategy(
        {
            clientID: process.env.FACEBOOK_APP_ID,
            clientSecret: process.env.FACEBOOK_APP_SECRET,
            callbackURL: process.env.FACEBOOK_CALLBACK_URL || 'https://makeasite-backend.onrender.com/api/auth/facebook/callback',
            profileFields: ['id', 'displayName', 'photos', 'email'],
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                const email = profile.emails?.[0]?.value;
                const avatar = profile.photos?.[0]?.value || '';
                const name = profile.displayName || 'Facebook User';

                let user = await User.findOne(
                    email
                        ? { $or: [{ email }, { provider: 'facebook', providerId: profile.id }] }
                        : { provider: 'facebook', providerId: profile.id }
                );

                if (user) {
                    let changed = false;
                    if (!user.providerId) { user.providerId = profile.id; changed = true; }
                    if (!user.avatar && avatar) { user.avatar = avatar; changed = true; }
                    if (!user.isVerified) { user.isVerified = true; changed = true; }
                    if (changed) await user.save();
                } else {
                    if (!email) return done(new Error('Facebook did not return an email. Please grant email permission.'), null);
                    user = await User.create({
                        name,
                        email,
                        avatar,
                        provider: 'facebook',
                        providerId: profile.id,
                        isVerified: true,
                        password: null,
                        country: '',
                    });
                }

                return done(null, user);
            } catch (err) {
                return done(err, null);
            }
        }
    ));
} else {
    console.info('ℹ️  Facebook OAuth: env vars not set. Facebook login will be disabled until configured.');
}

/* Passport session stubs — we use stateless JWT, so these are no-ops */
passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) { done(err, null); }
});

module.exports = passport;

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const User = require('../models/User');

/* ── Google Strategy ──────────────────────────────────── */
const googleSecretOk =
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    !process.env.GOOGLE_CLIENT_SECRET.startsWith('GOCSPX-REPLACE');

if (googleSecretOk) {
    passport.use(new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
            scope: ['profile', 'email'],
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                const email = profile.emails?.[0]?.value;
                const avatar = profile.photos?.[0]?.value || '';
                const name = profile.displayName || 'Google User';

                if (!email) return done(new Error('No email from Google profile'), null);

                // Find existing user by email OR by Google provider ID
                let user = await User.findOne({
                    $or: [{ email }, { provider: 'google', providerId: profile.id }]
                });

                if (user) {
                    // Update fields if missing
                    let changed = false;
                    if (!user.providerId) { user.providerId = profile.id; changed = true; }
                    if (!user.avatar && avatar) { user.avatar = avatar; changed = true; }
                    if (!user.isVerified) { user.isVerified = true; changed = true; }
                    if (changed) await user.save();
                } else {
                    // Create new social user
                    user = await User.create({
                        name,
                        email,
                        avatar,
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
} else {
    console.warn([
        '⚠️  Google OAuth DISABLED — action required:',
        '   1. Go to https://console.cloud.google.com/apis/credentials',
        '   2. Open your OAuth client → copy the real Client Secret',
        `   3. In backend/.env set: GOOGLE_CLIENT_SECRET=<your_real_secret>`,
        '   4. Add Authorised redirect URI: http://localhost:5000/api/auth/google/callback',
        '   5. Restart the backend server',
    ].join('\n'));
}

/* ── Facebook Strategy (activates when env vars are set) ── */
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {

    passport.use(new FacebookStrategy(
        {
            clientID: process.env.FACEBOOK_APP_ID,
            clientSecret: process.env.FACEBOOK_APP_SECRET,
            callbackURL: process.env.FACEBOOK_CALLBACK_URL || 'http://localhost:5000/api/auth/facebook/callback',
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

import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";
import User from "../models/User.js";

const normalizeEmail = (email) => email?.trim().toLowerCase();

export const upsertOAuthUser = async ({
  provider,
  providerId,
  name,
  email,
  avatar
}) => {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error(`${provider} account email is not available.`);
  }

  let user = await User.findOne({ email: normalizedEmail });

  if (user) {
    user.name = name || user.name;
    user.avatar = avatar || user.avatar;
    user.provider = provider;
    user.isVerified = true;
    user.emailVerified = true;
    if (provider === "google") user.googleId = providerId;
    if (provider === "facebook") user.facebookId = providerId;
    if (provider === "linkedin") user.linkedinId = providerId;
    await user.save();
  } else {
    user = await User.create({
      name: name || "User",
      email: normalizedEmail,
      avatar: avatar || "",
      googleId: provider === "google" ? providerId : undefined,
      facebookId: provider === "facebook" ? providerId : undefined,
      linkedinId: provider === "linkedin" ? providerId : undefined,
      provider,
      isVerified: true,
      emailVerified: true,
      phoneVerified: false
    });
  }

  return user;
};

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CALLBACK_URL) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const user = await upsertOAuthUser({
            provider: "google",
            providerId: profile.id,
            name: profile.displayName || profile.name?.givenName,
            email: profile.emails?.[0]?.value,
            avatar: profile.photos?.[0]?.value
          });

          return done(null, user);
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );
}

if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET && process.env.FACEBOOK_CALLBACK_URL) {
  passport.use(
    new FacebookStrategy(
      {
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: process.env.FACEBOOK_CALLBACK_URL,
        profileFields: ["id", "displayName", "photos", "email"]
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const user = await upsertOAuthUser({
            provider: "facebook",
            providerId: profile.id,
            name: profile.displayName,
            email: profile.emails?.[0]?.value,
            avatar: profile.photos?.[0]?.value
          });

          return done(null, user);
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );
}

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

export default passport;

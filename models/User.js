import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },

  email: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true
  },

  phone: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },

  password: {
    type: String,
    select: false
  },

  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user"
  },

  provider: {
    type: String,
    enum: ["local", "google", "facebook", "linkedin"],
    default: "local"
  },

  googleId: {
    type: String
  },

  facebookId: {
    type: String
  },

  linkedinId: {
    type: String
  },

  avatar: {
    type: String,
    default: ""
  },

  preferences: {
    notificationsEnabled: {
      type: Boolean,
      default: true
    }
  },

  isVerified: {
    type: Boolean,
    default: false
  },

  emailVerified: {
    type: Boolean,
    default: false
  },

  phoneVerified: {
    type: Boolean,
    default: false
  },

  otpCode: {
    type: String
  },

  otpExpire: {
    type: Date
  },

  emailOtpCode: {
    type: String
  },

  emailOtpExpire: {
    type: Date
  },

  phoneOtpCode: {
    type: String
  },

  phoneOtpExpire: {
    type: Date
  },

  loginOtpCode: {
    type: String
  },

  loginOtpExpire: {
    type: Date
  },

  loginOtpTarget: {
    type: String
  },

  loginOtpChannel: {
    type: String,
    default: null
  },

  lastLoginIP: {
    type: String
  },

  lastLoginAt: {
    type: Date
  }
}, {
  timestamps: true
});

const User = mongoose.model("User", userSchema);

export const cleanupUserIndexes = async () => {
  try {
    const indexes = await User.collection.indexes();
    const staleUsernameIndex = indexes.find((index) => index.name === "username_1");

    if (staleUsernameIndex) {
      await User.collection.dropIndex("username_1");
      console.log("Dropped stale username_1 index from users collection.");
    }
  } catch (error) {
    if (
      !error.message?.includes("ns not found") &&
      !error.message?.includes("index not found")
    ) {
      console.warn(`Could not clean user indexes: ${error.message}`);
    }
  }
};

export default User;

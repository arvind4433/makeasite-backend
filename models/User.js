const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    // password is optional — social-auth users have no password
    password: { type: String, default: null },
    country: { type: String, default: '' },
    phone: { type: String, default: '' },
    avatar: { type: String, default: '' },   // profile picture URL
    provider: { type: String, enum: ['local', 'google', 'facebook'], default: 'local' },
    providerId: { type: String, default: null },  // Google / Facebook UID
    isVerified: { type: Boolean, default: false },
    otp: { type: String },
    otpExpires: { type: Date },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
}, { timestamps: true });

/* Only hash password if it was set / changed */
userSchema.pre('save', async function (next) {
    if (!this.password || !this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
    if (!this.password) return false;
    return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);

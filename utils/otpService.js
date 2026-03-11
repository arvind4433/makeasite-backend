const generateOTP = () => {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    console.log("OTP:", otp); // terminal me dikhega

    return otp;
};

const verifyOTP = (storedOtp, enteredOtp, expiryTime) => {

    if (!storedOtp || !expiryTime) {
        return { valid: false, message: "No OTP requested" };
    }

    if (expiryTime < Date.now()) {
        return { valid: false, message: "OTP expired" };
    }

    if (storedOtp !== enteredOtp) {
        return { valid: false, message: "Invalid OTP" };
    }

    return { valid: true };
};

module.exports = { generateOTP, verifyOTP };
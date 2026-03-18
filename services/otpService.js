const OTP_EXPIRY_MS = 10 * 60 * 1000;

const FIELD_MAP = {
  email: { code: "emailOtpCode", expire: "emailOtpExpire", label: "email verification" },
  phone: { code: "phoneOtpCode", expire: "phoneOtpExpire", label: "phone verification" },
  login: { code: "loginOtpCode", expire: "loginOtpExpire", label: "login" },
  passwordReset: { code: "otpCode", expire: "otpExpire", label: "password reset" }
};

const resolveScope = (scope) => {
  const fields = FIELD_MAP[scope];

  if (!fields) {
    throw new Error(`Unsupported OTP scope: ${scope}`);
  }

  return fields;
};

export const generateOTP = () => String(Math.floor(100000 + Math.random() * 900000));

export const issueOTP = (user, scope = "passwordReset") => {
  const otp = generateOTP();
  const fields = resolveScope(scope);

  user[fields.code] = otp;
  user[fields.expire] = new Date(Date.now() + OTP_EXPIRY_MS);

  return otp;
};

export const verifyOTP = (user, otp, scope = "passwordReset") => {
  const fields = resolveScope(scope);
  const storedOtp = user[fields.code];
  const storedExpiry = user[fields.expire];

  if (!storedOtp || !storedExpiry) {
    return false;
  }

  if (new Date() > storedExpiry) {
    user[fields.code] = undefined;
    user[fields.expire] = undefined;
    return false;
  }

  if (String(otp) !== String(storedOtp)) {
    return false;
  }

  user[fields.code] = undefined;
  user[fields.expire] = undefined;
  return true;
};

import Joi from "joi";

const nameField = Joi.string()
  .trim()
  .min(2)
  .max(50)
  .pattern(/^[a-zA-Z\s]+$/)
  .required()
  .messages({
    "string.empty": "Name is required",
    "string.min": "Name must be at least 2 characters",
    "string.max": "Name cannot exceed 50 characters",
    "string.pattern.base": "Name can only contain letters"
  });

const emailField = Joi.string()
  .trim()
  .email()
  .lowercase()
  .messages({
    "string.email": "Invalid email format"
  });

const phoneField = Joi.string()
  .trim()
  .pattern(/^\+?[0-9]{10,15}$/)
  .messages({
    "string.pattern.base": "Invalid phone number"
  });

const otpField = Joi.string()
  .length(6)
  .pattern(/^[0-9]+$/)
  .required()
  .messages({
    "string.length": "OTP must be 6 digits",
    "string.pattern.base": "OTP must contain only numbers",
    "string.empty": "OTP is required"
  });

const passwordField = Joi.string()
  .min(6)
  .max(30)
  .required()
  .messages({
    "string.min": "Password must be at least 6 characters",
    "string.max": "Password cannot exceed 30 characters",
    "string.empty": "Password is required"
  });

export const registerSchema = Joi.object({
  name: nameField,
  email: emailField.required().messages({
    "any.required": "Email is required",
    "string.empty": "Email is required"
  }),
  phone: phoneField.required().messages({
    "any.required": "Phone number is required",
    "string.empty": "Phone number is required"
  }),
  password: passwordField
});

export const loginSchema = Joi.object({
  email: emailField.optional(),
  phone: phoneField.optional(),
  password: passwordField
})
  .or("email", "phone")
  .messages({
    "object.missing": "Email or phone is required"
  });

export const verifyOtpSchema = Joi.object({
  email: emailField.optional(),
  phone: phoneField.optional(),
  otp: otpField
})
  .or("email", "phone")
  .messages({
    "object.missing": "Email or phone is required"
  });

export const verifyContactSchema = Joi.object({
  email: emailField.optional(),
  phone: phoneField.optional(),
  channel: Joi.string().valid("email", "phone").required().messages({
    "any.only": "Channel must be email or phone",
    "string.empty": "Verification channel is required"
  }),
  otp: otpField
})
  .or("email", "phone")
  .messages({
    "object.missing": "Email or phone is required"
  });

export const sendProfileOtpSchema = Joi.object({
  channel: Joi.string().valid("email", "phone").required().messages({
    "any.only": "Channel must be email or phone",
    "string.empty": "Verification channel is required"
  })
});

export const verifyProfileOtpSchema = Joi.object({
  channel: Joi.string().valid("email", "phone").required().messages({
    "any.only": "Channel must be email or phone",
    "string.empty": "Verification channel is required"
  }),
  otp: otpField
});

export const forgotPasswordSchema = Joi.object({
  email: emailField.required().messages({
    "any.required": "Email is required",
    "string.empty": "Email is required"
  })
});

export const resetPasswordSchema = Joi.object({
  email: emailField.required().messages({
    "any.required": "Email is required",
    "string.empty": "Email is required"
  }),
  otp: otpField,
  password: passwordField
});

export const isTwilioVerifyConfigured = () => {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_VERIFY_SERVICE_SID
  );
};

export const isTwilioSmsConfigured = () => {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    (process.env.TWILIO_VERIFY_SERVICE_SID || process.env.TWILIO_PHONE_NUMBER)
  );
};

export const sendPhoneOtp = async ({ phone, otp, context = "verification" }) => {
  const normalizedPhone = phone?.trim();
  if (!normalizedPhone) {
    throw new Error("Phone number is required to send OTP");
  }

  const toPhone = normalizedPhone.startsWith("+") ? normalizedPhone : `+${normalizedPhone}`;
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID?.trim();
  const fromPhone = process.env.TWILIO_PHONE_NUMBER?.trim();

  // 1. Prioritize Twilio Verify API v2 if service SID is configured
  if (accountSid && authToken && verifyServiceSid) {
    try {
      const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
      const response = await fetch(
        `https://verify.twilio.com/v2/Services/${verifyServiceSid}/Verifications`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${authHeader}`,
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: new URLSearchParams({
            To: toPhone,
            Channel: "sms"
          })
        }
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || "Twilio Verify failed to send OTP");
      }

      console.log(`[Twilio Verify] Sent verification to ${toPhone} (SID: ${payload.sid})`);
      return {
        delivered: true,
        provider: "twilio-verify",
        sid: payload.sid
      };
    } catch (err) {
      console.error("Twilio Verify error:", err.message);
      if (process.env.NODE_ENV === "production") {
        throw err;
      }
    }
  }

  // 2. Fall back to Twilio Messages API if TWILIO_PHONE_NUMBER is configured
  if (accountSid && authToken && fromPhone) {
    try {
      const body = `Your MakeASite OTP is ${otp}. It expires in 10 minutes.`;
      const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${authHeader}`,
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: new URLSearchParams({
            To: toPhone,
            From: fromPhone,
            Body: body
          })
        }
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to send SMS OTP via Twilio");
      }

      console.log(`[Twilio SMS] Sent OTP to ${toPhone} (SID: ${payload.sid})`);
      return {
        delivered: true,
        provider: "twilio-sms",
        sid: payload.sid
      };
    } catch (err) {
      console.error("Twilio SMS error:", err.message);
      if (process.env.NODE_ENV === "production") {
        throw err;
      }
    }
  }

  // 3. In development without credentials: simulate cleanly
  if (process.env.NODE_ENV !== "production") {
    console.log(`[SMS Simulation (Dev)] To: ${toPhone} | OTP: ${otp} (Context: ${context})`);
    return {
      delivered: true,
      provider: "console"
    };
  }

  // 4. In production without credentials: throw clear exception
  throw new Error("Twilio SMS service is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID in .env.");
};

export const checkTwilioVerifyCode = async ({ phone, code }) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID?.trim();

  if (!accountSid || !authToken || !verifyServiceSid) {
    return null; // Not using Twilio Verify service
  }

  const normalizedPhone = phone?.trim();
  const toPhone = normalizedPhone.startsWith("+") ? normalizedPhone : `+${normalizedPhone}`;
  const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  try {
    const response = await fetch(
      `https://verify.twilio.com/v2/Services/${verifyServiceSid}/VerificationCheck`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${authHeader}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          To: toPhone,
          Code: String(code).trim()
        })
      }
    );

    const payload = await response.json().catch(() => ({}));
    if (response.ok && payload.status === "approved") {
      console.log(`[Twilio Verify] Code approved for ${toPhone}`);
      return true;
    }

    return false;
  } catch (err) {
    console.error("Twilio VerificationCheck failed:", err.message);
    return false;
  }
};

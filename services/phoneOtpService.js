export const sendPhoneOtp = async ({ phone, otp, context = "verification" }) => {
  const normalizedPhone = phone?.trim();
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromPhone = process.env.TWILIO_PHONE_NUMBER;

  if (!normalizedPhone) {
    throw new Error("Phone number is required to send OTP");
  }

  if (!accountSid || !authToken || !fromPhone) {
    return {
      delivered: process.env.NODE_ENV === "production" ? false : true,
      provider: "console"
    };
  }

  const toPhone = normalizedPhone.startsWith("+") ? normalizedPhone : `+${normalizedPhone}`;
  const body = `Your MakeASite OTP is ${otp}. It expires in 10 minutes.`;
  const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
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
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.message || "Failed to send SMS OTP");
  }

  return {
    delivered: true,
    provider: "twilio",
    sid: payload.sid
  };
};

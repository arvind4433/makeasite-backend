import Razorpay from "razorpay";

const getRazorpayInstance = () => {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    throw new Error("Razorpay credentials are not configured in environment variables.");
  }

  return new Razorpay({ key_id, key_secret });
};


export const createRazorpayOrder = async (amount, currency = "INR") => {
  try {
    const razorpay = getRazorpayInstance();
    const order = await razorpay.orders.create({
      amount: amount*100, // already in paise
      currency,
      receipt:`receipt_${Date.now()}`,
      partial_payment: false,
      notes: {
        source: "makeasite",
      },
    });

    return order;
  } catch (error) {
    console.error("Razorpay Order Error:", error);
    throw error;
  }
};

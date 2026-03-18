import Razorpay from "razorpay";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});


export const createRazorpayOrder = async (amount, currency = "INR") => {
  try {
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

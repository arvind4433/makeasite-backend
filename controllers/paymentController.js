const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../models/Order');
const Payment = require('../models/Payment');

// ── Razorpay instance ────────────────────────────────────────────
const getRazorpay = () => {
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key_id || !key_secret) {
        throw new Error('Razorpay credentials not configured in .env');
    }
    return new Razorpay({ key_id, key_secret });
};

// @desc    Create Razorpay Order — Step 1 of payment
// @route   POST /api/payments/razorpay
// @access  Private
const createRazorpayPayment = async (req, res) => {
    try {
        const { orderId } = req.body;
        const order = await Order.findById(orderId);

        if (!order) return res.status(404).json({ message: 'Order not found' });

        if (order.paymentStatus === 'Completed') {
            return res.status(400).json({ message: 'This order has already been paid.' });
        }

        const instance = getRazorpay();

        // Razorpay amount is in smallest currency unit (paise for INR)
        // Budget is stored in SAR — convert to INR (1 SAR ≈ 22.5 INR)
        // For SAR-native billing: use currency:'SAR' and amount in halalas (budget * 100)
        const amount = Math.max(order.budget * 100, 100); // min 1 INR
        const currency = 'INR'; // Change to 'SAR' if your Razorpay account supports it

        const rzpOrder = await instance.orders.create({
            amount,
            currency,
            receipt: `wp_${order._id.toString().slice(-8)}_${Date.now()}`,
            notes: {
                projectName: order.projectName,
                plan: order.plan,
                userId: order.userId.toString(),
            },
        });

        // Upsert preliminary payment record
        await Payment.findOneAndUpdate(
            { orderId: order._id },
            {
                orderId: order._id,
                amount: order.budget,
                transactionId: rzpOrder.id,
                paymentStatus: 'Pending',
            },
            { upsert: true, new: true }
        );

        res.json({
            id: rzpOrder.id,
            amount: rzpOrder.amount,
            currency: rzpOrder.currency,
            key: process.env.RAZORPAY_KEY_ID,      // send key to frontend
            projectName: order.projectName,
            plan: order.plan,
        });
    } catch (error) {
        console.error('Razorpay order creation error:', error.message);
        res.status(500).json({ message: error.message || 'Payment gateway error. Please try again.' });
    }
};

// @desc    Verify Razorpay payment signature — Step 2 of payment
// @route   POST /api/payments/verify
// @access  Private
const verifyPayment = async (req, res) => {
    try {
        const {
            orderId,                   // our DB order ID
            razorpay_order_id,         // from Razorpay
            razorpay_payment_id,       // from Razorpay
            razorpay_signature,        // from Razorpay — MUST verify
        } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ message: 'Missing payment verification fields' });
        }

        // ── Signature verification ────────────────────────────────────
        // Razorpay signature = HMAC-SHA256(razorpay_order_id + "|" + razorpay_payment_id, key_secret)
        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (generatedSignature !== razorpay_signature) {
            console.error('Payment signature mismatch!');
            return res.status(400).json({ message: 'Payment verification failed — invalid signature.' });
        }

        // ── Signature valid — mark payment complete ────────────────────
        await Payment.findOneAndUpdate(
            { transactionId: razorpay_order_id },
            { paymentStatus: 'Completed', razorpayPaymentId: razorpay_payment_id },
            { new: true }
        );

        const order = await Order.findByIdAndUpdate(
            orderId,
            { paymentStatus: 'Completed', status: 'Accepted' },
            { new: true }
        );

        if (!order) return res.status(404).json({ message: 'Order not found after payment' });

        console.log(`✅ Payment verified | Order: ${orderId} | RZP Payment: ${razorpay_payment_id}`);
        res.json({ success: true, order });
    } catch (error) {
        console.error('Payment verify error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createRazorpayPayment,
    verifyPayment,
};

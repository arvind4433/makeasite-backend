const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    amount: { type: Number, required: true },
    transactionId: { type: String, required: true },         // Razorpay order ID (rzp_order_xxx)
    razorpayPaymentId: { type: String, default: '' },        // Razorpay payment ID (pay_xxx) after success
    paymentStatus: { type: String, enum: ['Completed', 'Pending', 'Failed'], default: 'Pending' },
}, {
    timestamps: true,
});

module.exports = mongoose.model('Payment', paymentSchema);

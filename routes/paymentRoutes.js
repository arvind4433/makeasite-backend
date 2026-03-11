const express = require('express');
const router = express.Router();
const { createRazorpayPayment, verifyPayment } = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

router.post('/razorpay', protect, createRazorpayPayment);
router.post('/verify', protect, verifyPayment);

module.exports = router;

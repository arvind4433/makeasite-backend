import express from "express";

import {
 createPayment,
 createRazorpayPayment,
 verifyRazorpayPayment,
 verifyPayment,
 getMyPayments
} from "../controllers/paymentController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, createPayment);
router.get("/my", protect, getMyPayments);
router.post("/razorpay", protect, createRazorpayPayment);
router.post("/verify", protect, verifyRazorpayPayment);
router.post("/verify-manual", protect, verifyPayment);

export default router;

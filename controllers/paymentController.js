import Payment from "../models/Payment.js";
import Order from "../models/Order.js";
import { createRazorpayOrder } from "../services/paymentService.js";
import crypto from "crypto";

export const createPayment = async (req, res) => {
  const { orderId, amount, method } = req.body;

  const order = await Order.findById(orderId);

  if (!order) {
    return res.status(404).json({
      message: "Order not found"
    });
  }

  const payment = await Payment.create({
    user: req.user._id,
    order: orderId,
    amount,
    method
  });

  res.status(201).json(payment);
};

export const createRazorpayPayment = async (req, res) => {
  const { orderId } = req.body;

  const order = await Order.findById(orderId);

  if (!order) {
    return res.status(404).json({
      message: "Order not found"
    });
  }

  const rzpOrder = await createRazorpayOrder(order.price);

  await Payment.create({
    user: req.user._id,
    order: orderId,
    amount: order.price,
    method: "razorpay",
    status: "pending",
    transactionId: rzpOrder.id
  });

  res.json({
    key: process.env.RAZORPAY_KEY_ID,
    amount: rzpOrder.amount,
    currency: rzpOrder.currency,
    id: rzpOrder.id,
    projectName: order.title,
    plan: order.packageType
  });
};

export const verifyRazorpayPayment = async (req, res) => {
  const {
    orderId,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature
  } = req.body;

  const body = razorpay_order_id + "|" + razorpay_payment_id;

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    return res.status(400).json({
      message: "Payment verification failed"
    });
  }

  const payment = await Payment.findOne({
    transactionId: razorpay_order_id
  });

  if (payment) {
    payment.status = "paid";
    payment.transactionId = razorpay_payment_id;
    await payment.save();
  }

  const order = await Order.findById(orderId);

  if (order) {
    order.status = "in_progress";
    await order.save();
  }

  res.json({
    message: "Payment verified successfully"
  });
};

export const verifyPayment = async (req, res) => {
  const { paymentId, status } = req.body;

  const payment = await Payment.findById(paymentId);

  if (!payment) {
    return res.status(404).json({
      message: "Payment not found"
    });
  }

  payment.status = status;
  await payment.save();

  res.json(payment);
};

export const getPaymentByOrder = async (req, res) => {
  const payment = await Payment.findOne({
    order: req.params.id
  });

  res.json(payment);
};

export const getMyPayments = async (req, res) => {
  const payments = await Payment.find({ user: req.user._id })
    .populate("order", "title packageType status price createdAt")
    .sort({ createdAt: -1 });

  res.json(payments);
};

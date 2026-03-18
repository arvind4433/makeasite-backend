import Order from "../models/Order.js";
import { calculateOrderPricing } from "../utils/pricing.js";

const normalizeOrderPayload = (body = {}) => {
  const featureIds = Array.isArray(body.featureIds)
    ? body.featureIds
    : Array.isArray(body.selectedFeatures)
      ? body.selectedFeatures.map((item) => typeof item === "string" ? item : item?.id).filter(Boolean)
      : [];

  const projectConfig = {
    presetId: body.projectConfig?.presetId || body.presetId || "custom",
    planName: body.projectConfig?.planName || body.planName || "Custom Project",
    siteKind: body.projectConfig?.siteKind || body.siteKind || "static",
    websiteType: body.projectConfig?.websiteType || body.websiteType || "Custom",
    pages: Number(body.projectConfig?.pages || body.pages || 1),
    businessCategory: body.projectConfig?.businessCategory || body.businessCategory || "",
    designStyle: body.projectConfig?.designStyle || body.designStyle || "",
    authTier: body.projectConfig?.authTier || body.authTier || "none",
    paymentIntegration: Boolean(body.projectConfig?.paymentIntegration ?? body.paymentIntegration),
    deliveryOption: body.projectConfig?.deliveryOption || body.deliveryOption || "normal",
    referenceWebsites: body.projectConfig?.referenceWebsites || body.referenceWebsites || "",
    contactEmail: body.projectConfig?.contactEmail || body.contactEmail || "",
    phoneNumber: body.projectConfig?.phoneNumber || body.phoneNumber || ""
  };

  return {
    title: body.title,
    description: body.description,
    packageType: body.packageType || "basic",
    deadline: body.deadline || null,
    featureIds,
    projectConfig
  };
};

export const createOrder = async (req, res) => {
  if (!req.user?.emailVerified || !req.user?.phoneVerified) {
    return res.status(403).json({
      message: "Please verify your email and phone before creating an order."
    });
  }

  const payload = normalizeOrderPayload(req.body);
  const pricing = calculateOrderPricing({
    siteKind: payload.projectConfig.siteKind,
    pages: payload.projectConfig.pages,
    authTier: payload.projectConfig.authTier,
    paymentIntegration: payload.projectConfig.paymentIntegration,
    featureIds: payload.featureIds,
    deliveryOption: payload.projectConfig.deliveryOption
  });

  const order = await Order.create({
    client: req.user._id,
    title: payload.title,
    description: payload.description,
    packageType: payload.packageType,
    price: pricing.total,
    priceBreakdown: pricing.breakdown,
    selectedFeatures: pricing.selectedFeatures,
    projectConfig: payload.projectConfig,
    deadline: payload.deadline
  });

  res.status(201).json(order);
};

export const getMyOrders = async (req, res) => {
  const orders = await Order.find({
    client: req.user._id
  }).sort({ createdAt: -1 });

  res.json(orders);
};

export const getAllOrders = async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }

  const orders = await Order.find({})
    .populate("client", "name email phone avatar")
    .sort({ createdAt: -1 });

  res.json(orders);
};

export const getOrderById = async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate("client", "name email phone avatar");

  if (!order) {
    return res.status(404).json({
      message: "Order not found"
    });
  }

  if (req.user.role !== "admin" && String(order.client?._id || order.client) !== String(req.user._id)) {
    return res.status(403).json({ message: "Access denied" });
  }

  res.json(order);
};

export const updateOrderStatus = async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }

  const { status } = req.body;
  const order = await Order.findById(req.params.id);

  if (!order) {
    return res.status(404).json({
      message: "Order not found"
    });
  }

  order.status = status;
  await order.save();

  const updatedOrder = await Order.findById(order._id).populate("client", "name email phone avatar");
  res.json(updatedOrder);
};

export const deleteOrder = async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return res.status(404).json({
      message: "Order not found"
    });
  }

  if (req.user.role !== "admin" && String(order.client) !== String(req.user._id)) {
    return res.status(403).json({ message: "Access denied" });
  }

  await order.deleteOne();

  res.json({
    message: "Order deleted"
  });
};

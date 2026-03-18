import mongoose from "mongoose";

const breakdownItemSchema = new mongoose.Schema({
  key: String,
  label: String,
  amount: Number
}, { _id: false });

const featureSchema = new mongoose.Schema({
  id: String,
  label: String,
  price: Number
}, { _id: false });

const projectConfigSchema = new mongoose.Schema({
  presetId: String,
  planName: String,
  siteKind: {
    type: String,
    enum: ["static", "dynamic"],
    default: "static"
  },
  websiteType: String,
  pages: Number,
  businessCategory: String,
  designStyle: String,
  authTier: {
    type: String,
    enum: ["none", "basic", "premium"],
    default: "none"
  },
  paymentIntegration: {
    type: Boolean,
    default: false
  },
  deliveryOption: {
    type: String,
    enum: ["normal", "fast", "urgent"],
    default: "normal"
  },
  referenceWebsites: String,
  contactEmail: String,
  phoneNumber: String
}, { _id: false });

const orderSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  title: {
    type: String,
    required: true
  },

  description: {
    type: String,
    required: true
  },

  packageType: {
    type: String,
    enum: ["basic", "standard", "premium", "custom"],
    default: "basic"
  },

  price: {
    type: Number,
    required: true
  },

  priceBreakdown: [breakdownItemSchema],

  selectedFeatures: [featureSchema],

  projectConfig: projectConfigSchema,

  status: {
    type: String,
    enum: [
      "pending",
      "in_progress",
      "delivered",
      "completed",
      "cancelled"
    ],
    default: "pending"
  },

  deadline: Date,

  files: [
    {
      url: String,
      name: String
    }
  ]

}, {
  timestamps: true
});

const Order = mongoose.model("Order", orderSchema);

export default Order;

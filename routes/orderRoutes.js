import express from "express";

import {
 createOrder,
 getMyOrders,
 getAllOrders,
 getOrderById,
 updateOrderStatus,
 deleteOrder
} from "../controllers/orderController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, createOrder);
router.get("/", protect, getAllOrders);
router.get("/myorders", protect, getMyOrders);
router.get("/:id", protect, getOrderById);
router.put("/:id/status", protect, updateOrderStatus);
router.delete("/:id", protect, deleteOrder);

export default router;

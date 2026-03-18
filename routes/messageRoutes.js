import express from "express";

import {
 sendMessage,
 getMessages,
 getMessageThreads,
 markThreadAsRead
} from "../controllers/messageController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/threads", protect, getMessageThreads);
router.post("/", protect, sendMessage);
router.patch("/:orderId/read", protect, markThreadAsRead);
router.get("/:orderId", protect, getMessages);

export default router;

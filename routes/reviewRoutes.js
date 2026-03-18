import express from "express";

import {
 createReview,
 getReviewsByOrder
} from "../controllers/reviewController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, createReview);

router.get("/:orderId", getReviewsByOrder);

export default router;
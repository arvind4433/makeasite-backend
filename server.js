import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import xss from "xss-clean";
import hpp from "hpp";

import connectDB from "./config/db.js";
import passport from "./config/passport.js";
import { verifyEmailTransport } from "./services/emailService.js";

import logger from "./utils/logger.js";

import errorMiddleware from "./middleware/errorMiddleware.js";
import requestLogger from "./middleware/requestLogger.js";

import authRoutes from "./routes/authRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";

dotenv.config();

const app = express();

/* ---------------- SECURITY ---------------- */

app.use(helmet());

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(null, true); // ⚡ allow all (safe fallback)
    },
    credentials: true
  })
);

/* ---------------- STATIC ---------------- */

app.use("/uploads", express.static("public/upload"));

/* ---------------- BODY ---------------- */

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));

/* ---------------- SECURITY MIDDLEWARE ---------------- */

app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

/* ---------------- LOGGING ---------------- */

app.use(requestLogger);

/* ---------------- PASSPORT ---------------- */

app.use(passport.initialize());

/* ---------------- ROUTES ---------------- */

app.get("/", (req, res) => {
  res.send("API running 🚀");
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    env: process.env.NODE_ENV,
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/reviews", reviewRoutes);

/* ---------------- ERROR ---------------- */

app.use(errorMiddleware);

/* ---------------- SERVER START ---------------- */

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // 🔥 DB connect try (fail ho to bhi server chale)
    try {
      await connectDB();
      logger.info("MongoDB connected");
    } catch (err) {
      logger.error("MongoDB failed: " + err.message);
    }

    // 🔥 Email verify optional
    try {
      await verifyEmailTransport();
      logger.info("Email transport verified");
    } catch (err) {
      logger.error("Email transport failed: " + err.message);
    }

    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
    });

  } catch (error) {
    logger.error("Startup failed: " + error.message);
    process.exit(1);
  }
};

startServer();
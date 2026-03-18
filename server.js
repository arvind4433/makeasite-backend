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

/* SECURITY */

app.use(helmet());

const FRONTEND_ORIGIN =
  process.env.FRONTEND_URL || "https://makeasite.online";

const envOrigins = String(process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = [
  "https://makeasite.online",
  "https://www.makeasite.online",
  "http://localhost:5173",
  "http://localhost:3000",
  FRONTEND_ORIGIN,
  ...envOrigins
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true
  })
);

/* STATIC FILES */

app.use("/uploads", express.static("public/upload"));

/* BODY PARSER */

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));

/* SECURITY MIDDLEWARE */

app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

/* LOGGING */

app.use(requestLogger);

/* PASSPORT */

app.use(passport.initialize());

/* ROUTES */

app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/reviews", reviewRoutes);

/* HEALTH CHECK */

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    env: process.env.NODE_ENV,
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

/* ERROR HANDLER */

app.use(errorMiddleware);

/* SERVER */

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    try {
      await verifyEmailTransport();
      logger.info("Email transport verified successfully.");
    } catch (error) {
      logger.error(`Email transport verification failed: ${error.message}`);
    }

    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Frontend URL: ${FRONTEND_ORIGIN}`);
    });
  } catch (error) {
    logger.error(`Startup failed: ${error.message}`);
    process.exit(1);
  }
};

startServer();

import mongoose from "mongoose";
import connectDB, { ensureDBConnected, isDBConnected } from "../config/db.js";

/**
 * Middleware that ensures MongoDB is connected before handling requests.
 * If the connection is already active, it immediately calls next().
 * If disconnected or connecting, it waits for the connection attempt.
 * If the connection fails, it responds with a clean 503 Service Unavailable error.
 */
export const requireDB = async (req, res, next) => {
  const isConnected =
    typeof isDBConnected === "function"
      ? isDBConnected()
      : mongoose.connection.readyState === 1;

  if (isConnected) {
    return next();
  }

  try {
    if (typeof ensureDBConnected === "function") {
      await ensureDBConnected();
    } else if (typeof connectDB === "function") {
      await connectDB();
    }
    next();
  } catch (error) {
    return res.status(503).json({
      success: false,
      message: `Database unavailable: ${error.message}`
    });
  }
};

export default requireDB;

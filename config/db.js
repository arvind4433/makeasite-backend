import mongoose from 'mongoose';
import dns from 'dns';
import dotenv from 'dotenv';
import { cleanupUserIndexes } from '../models/User.js';

dotenv.config({});

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

// Resolve Atlas SRV lookups reliably on Windows
try {
  dns.setDefaultResultOrder('ipv4first');
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (dnsErr) {
  console.warn('[MongoDB] DNS setup warning:', dnsErr.message);
}

// Track singleton connection promise to prevent race conditions and duplicate connections
let connectionPromise = null;
let triedDnsFallback = false;

// Disable Mongoose query buffering globally so operations fail fast with descriptive errors
// instead of hanging for 10000ms when the database is not connected.
mongoose.set('bufferCommands', false);

const validateURI = (rawUri) => {
  if (!rawUri || typeof rawUri !== 'string') {
    throw new Error('MONGODB_URI is not defined in environment variables. Please check your .env file.');
  }

  const trimmed = rawUri.trim();

  if (!trimmed) {
    throw new Error('MONGODB_URI is empty. Please provide a valid MongoDB connection string.');
  }

  if (trimmed.includes('<username>') || trimmed.includes('<password>')) {
    throw new Error('MONGODB_URI contains placeholder <username> or <password>. Please replace them with actual MongoDB credentials in .env.');
  }

  return trimmed;
};

export const connectDB = async () => {
  // If already fully connected, return immediately
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // If a connection attempt is currently in flight, reuse that promise
  if (connectionPromise) {
    return connectionPromise;
  }

  const uri = validateURI(process.env.MONGODB_URI);

  connectionPromise = (async () => {
    let lastError;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        console.log(`[MongoDB] Connecting to database (attempt ${attempt}/${MAX_RETRIES})...`);

        await mongoose.connect(uri, {
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 30000,
          connectTimeoutMS: 10000,
          maxPoolSize: 10
        });

        console.log('[MongoDB] Connected successfully');
        await cleanupUserIndexes();
        return mongoose.connection;
      } catch (error) {
        lastError = error;
        console.error(`[MongoDB] Connection error (attempt ${attempt}/${MAX_RETRIES}): ${error.message}`);

        // If SRV lookup fails on local DNS, try fallback to public DNS (8.8.8.8, 1.1.1.1)
        if (
          !triedDnsFallback &&
          (error.message?.includes('querySrv') || error.message?.includes('ENOTFOUND'))
        ) {
          triedDnsFallback = true;
          try {
            console.warn('[MongoDB] SRV lookup issue detected. Switching DNS servers to [8.8.8.8, 1.1.1.1]...');
            dns.setDefaultResultOrder('ipv4first');
            dns.setServers(['8.8.8.8', '1.1.1.1']);
          } catch (dnsErr) {
            console.warn('[MongoDB] Unable to set fallback DNS:', dnsErr.message);
          }
        }

        if (attempt < MAX_RETRIES) {
          console.log(`[MongoDB] Retrying in ${RETRY_DELAY_MS / 1000}s...`);
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        }
      }
    }

    connectionPromise = null;
    throw lastError;
  })();

  try {
    return await connectionPromise;
  } catch (err) {
    connectionPromise = null;
    throw err;
  }
};

/**
 * Ensures the database is connected before executing any database operation.
 * If currently connecting, awaits the connection promise.
 * If disconnected, initiates connectDB().
 */
export const ensureDBConnected = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (connectionPromise) {
    return await connectionPromise;
  }

  return await connectDB();
};

export const isDBConnected = () => mongoose.connection.readyState === 1;

mongoose.connection.on('disconnected', () => {
  console.warn('[MongoDB] Connection disconnected.');
  connectionPromise = null;
});

mongoose.connection.on('reconnected', () => {
  console.log('[MongoDB] Connection reconnected.');
});

mongoose.connection.on('error', (error) => {
  console.error(`[MongoDB] Connection runtime error: ${error.message}`);
});

export default connectDB;

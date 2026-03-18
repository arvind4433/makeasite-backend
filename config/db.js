import mongoose from 'mongoose';
import dns from 'dns';
import dotenv from 'dotenv';
import { cleanupUserIndexes } from '../models/User.js';

dotenv.config({});

// Atlas SRV lookups can fail on some local DNS resolvers.
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 15000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 15000,
        maxPoolSize: 10
      });

      await cleanupUserIndexes();
      console.log('MongoDB connected successfully');
      return;
    } catch (error) {
      lastError = error;
      console.error(
        `MongoDB connection error (attempt ${attempt}/${MAX_RETRIES}): ${error.message}`
      );

      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }

  throw lastError;
};

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected.');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected.');
});

mongoose.connection.on('error', (error) => {
  console.error(`MongoDB error: ${error.message}`);
});

export default connectDB;

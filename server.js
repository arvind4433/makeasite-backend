const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');

// Load environment variables FIRST
dotenv.config();

// Passport — must load after dotenv so strategies can read env vars
const passport = require('./config/passport');

const app = express();

// ── Security HTTP headers ──────────────────────────────
app.use(helmet());

// ── CORS — allow frontend origin from env ─────────────
const FRONTEND_ORIGIN = process.env.FRONTEND_URL || 'https://makeasite.online';

const allowedOrigins = new Set([
    'https://makeasite.online',
    'https://www.makeasite.online',   // www subdomain — live production
    'http://localhost:5173',           // Vite dev
    'http://localhost:3000',           // CRA / Next dev
    FRONTEND_ORIGIN,                   // Whatever is in FRONTEND_URL env var
]);

app.use(cors({
    origin: (origin, callback) => {
        // Allow no-origin requests (Postman, curl, server-to-server)
        if (!origin || allowedOrigins.has(origin)) return callback(null, true);
        callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body parser ────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ── Data sanitization ──────────────────────────────────
app.use(mongoSanitize()); // NoSQL injection
app.use(xss());           // XSS

// ── HTTP parameter pollution prevention ───────────────
app.use(hpp());

// ── Passport (stateless — no sessions needed) ─────────
app.use(passport.initialize());

// ── Rate Limiting ──────────────────────────────────────
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests from this IP, please try again in 15 minutes.' },
});
app.use('/api', limiter);

// ── Database connection ────────────────────────────────
const connectDB = require('./config/db');
connectDB();

// ── Routes ─────────────────────────────────────────────
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));

// ── Health check ───────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        env: process.env.NODE_ENV,
        db: require('mongoose').connection.readyState === 1 ? 'connected' : 'disconnected',
    });
});

// ── Global error handler ───────────────────────────────
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err.message);
    res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
});

// ── Start server ───────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    console.log(`🌐 Frontend URL: ${FRONTEND_ORIGIN}`);
});

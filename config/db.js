const mongoose = require('mongoose');
const dns = require('dns');

// ── ISP DNS fix ───────────────────────────────────────
// The local ISP DNS cannot resolve MongoDB Atlas SRV records.
// Override to use Google Public DNS (8.8.8.8) within this process.
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

let retryCount = 0;
const MAX_RETRIES = 5;
const RETRY_DELAY = 5000; // 5 seconds

/**
 * Converts an SRV URI (mongodb+srv://) to a standard mongodb:// URI if needed.
 * This avoids DNS SRV lookup failures on some Windows/ISP DNS configurations.
 * The standard port for Atlas is 27017.
 */
const normalizeUri = (uri) => {
    if (!uri) return uri;
    // If it's already a standard URI, return as-is
    if (!uri.startsWith('mongodb+srv://')) return uri;
    // Keep as SRV — the driver will handle it; we just add options
    return uri;
};

const connectDB = async () => {
    const rawUri = process.env.MONGODB_URI || process.env.MONGO_URL;

    if (!rawUri) {
        console.error('❌ MONGODB_URI is not defined in .env');
        return;
    }

    const uri = normalizeUri(rawUri);

    const options = {
        serverSelectionTimeoutMS: 15000,  // 15s to find a server
        socketTimeoutMS: 45000,
        connectTimeoutMS: 15000,
        maxPoolSize: 10,
        // Don't force family: 4 — let the OS resolve DNS naturally
    };

    try {
        await mongoose.connect(uri, options);
        retryCount = 0;
        const db = mongoose.connection;
        console.log(`✅ MongoDB Connected | DB: ${db.name} | State: ${db.readyState}`);

        // ── Drop any stale legacy indexes ──────────────────────────────
        // The old Order model had a unique `orderNumber` index which causes
        // E11000 duplicate key errors when orderNumber is null/missing.
        try {
            const ordersCollection = db.collection('orders');
            const indexes = await ordersCollection.indexes();
            const staleIndex = indexes.find(idx => idx.name === 'orderNumber_1');
            if (staleIndex) {
                await ordersCollection.dropIndex('orderNumber_1');
                console.log('🔧 Dropped stale orderNumber_1 index from orders collection.');
            }
        } catch (idxErr) {
            if (!idxErr.message?.includes('ns not found') && !idxErr.message?.includes('index not found')) {
                console.warn('⚠️  Could not remove orderNumber_1 index:', idxErr.message);
            }
        }
    } catch (error) {
        retryCount++;
        console.error(`❌ MongoDB connection error (attempt ${retryCount}/${MAX_RETRIES}): ${error.message}`);

        if (retryCount < MAX_RETRIES) {
            console.log(`🔄 Retrying in ${RETRY_DELAY / 1000}s...`);
            setTimeout(connectDB, RETRY_DELAY);
        } else {
            console.error('❌ Max retries reached. Auth endpoints will not work until DB is reachable.');
            console.error('   👉 Make sure your IP is whitelisted in MongoDB Atlas → Network Access');
        }
    }

};

// Handle disconnection events
mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB disconnected.');
});

mongoose.connection.on('reconnected', () => {
    console.log('✅ MongoDB reconnected.');
});

mongoose.connection.on('error', (err) => {
    console.error(`❌ MongoDB error: ${err.message}`);
});

module.exports = connectDB;

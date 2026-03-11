const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Core plan
    plan: { type: String, required: true },
    budget: { type: Number, default: 0 },

    // Project identity
    projectName: { type: String, required: true },
    companyName: { type: String },
    businessCategory: { type: String },
    businessType: { type: String },

    // Technical specs
    websiteType: { type: String },
    pages: { type: Number, default: 3 },
    features: [{ type: String }],
    addons: [{ type: String }],
    designStyle: { type: String },

    // Communication
    description: { type: String },
    referenceWebsites: { type: String },
    contactEmail: { type: String },
    phoneNumber: { type: String },

    // Scheduling
    preferredDeadline: { type: String },
    deliveryOption: { type: String, default: 'normal' },

    // Status
    status: {
        type: String,
        enum: ['Pending', 'Viewed', 'Accepted', 'Rejected', 'In Progress', 'Completed'],
        default: 'Pending',
    },
    adminResponse: { type: String, default: '' },
    paymentStatus: { type: String, enum: ['Pending', 'Completed', 'Failed'], default: 'Pending' },
}, {
    timestamps: true,
});

// Drop stale orderNumber index on startup if it exists
orderSchema.statics.dropLegacyIndexes = async function () {
    try {
        const collection = this.collection;
        const indexes = await collection.indexes();
        const hasOrderNumber = indexes.some(idx => idx.name === 'orderNumber_1');
        if (hasOrderNumber) {
            await collection.dropIndex('orderNumber_1');
            console.log('✅ Dropped stale orderNumber_1 index from orders collection');
        }
    } catch (err) {
        // Ignore — index might have already been dropped
        if (!err.message?.includes('index not found')) {
            console.warn('⚠️  Could not drop orderNumber_1 index:', err.message);
        }
    }
};

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;

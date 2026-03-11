const Order = require('../models/Order');
const sendEmail = require('../utils/sendEmail');

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const createOrder = async (req, res) => {
    try {
        const {
            plan, budget, projectName, companyName, businessCategory, businessType,
            websiteType, pages, features, addons, designStyle, description,
            referenceWebsites, contactEmail, phoneNumber, preferredDeadline, deliveryOption,
        } = req.body;

        if (!projectName) return res.status(400).json({ message: 'Project name is required' });

        const order = new Order({
            userId: req.user._id,
            plan, budget, projectName, companyName, businessCategory, businessType,
            websiteType, pages, features, addons, designStyle, description,
            referenceWebsites, contactEmail, phoneNumber, preferredDeadline, deliveryOption,
        });

        const createdOrder = await order.save();

        // Notify client (fire-and-forget)
        sendEmail({
            email: req.user.email,
            subject: `Order Received: ${projectName} — ${plan} Plan`,
            html: `
                <div style="font-family:Arial,sans-serif;max-width:540px;margin:auto;padding:32px;border-radius:12px;background:#0f172a;color:#f1f5f9">
                    <h2 style="color:#ef4444">Order Confirmed! 🚀</h2>
                    <p style="color:#94a3b8">Hi ${req.user.name}, we have received your project request and added it to your cart.</p>
                    <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:16px;margin:16px 0">
                        <p style="margin:4px 0;color:#e2e8f0;font-size:14px"><strong>Project:</strong> ${projectName}</p>
                        <p style="margin:4px 0;color:#e2e8f0;font-size:14px"><strong>Plan:</strong> ${plan}</p>
                        <p style="margin:4px 0;color:#e2e8f0;font-size:14px"><strong>Website Type:</strong> ${websiteType || 'Not specified'}</p>
                        <p style="margin:4px 0;color:#e2e8f0;font-size:14px"><strong>Pages:</strong> ${pages}</p>
                        <p style="margin:4px 0;color:#e2e8f0;font-size:14px"><strong>Estimated Budget:</strong> SAR ${(budget || 0).toLocaleString()}</p>
                    </div>
                    <p style="color:#94a3b8">Your order is now in the cart. Please proceed to payment from your dashboard.</p>
                    <p style="color:#64748b;font-size:12px;margin-top:24px">Thank you for choosing WebDevPro.</p>
                </div>`,
        }).catch(() => { });

        res.status(201).json(createdOrder);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get logged-in user orders
// @route   GET /api/orders/myorders
// @access  Private
const getMyOrders = async (req, res) => {
    try {
        const orders = await Order.find({ userId: req.user._id }).sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all orders (admin)
// @route   GET /api/orders
// @access  Private/Admin
const getOrders = async (req, res) => {
    try {
        const orders = await Order.find({}).populate('userId', 'id name email country').sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update order status (admin)
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = async (req, res) => {
    try {
        const { status, adminResponse } = req.body;
        const order = await Order.findById(req.params.id).populate('userId', 'email name');

        if (!order) return res.status(404).json({ message: 'Order not found' });

        order.status = status || order.status;
        if (adminResponse !== undefined) order.adminResponse = adminResponse;
        const updatedOrder = await order.save();

        if (status) {
            sendEmail({
                email: order.userId.email,
                subject: `Project Status Update: ${status}`,
                html: `
                    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;border-radius:12px;background:#0f172a;color:#f1f5f9">
                        <h2 style="color:#ef4444">Project Update</h2>
                        <p style="color:#94a3b8">Hi ${order.userId.name}, your project <strong>${order.projectName || order.plan}</strong> has been updated.</p>
                        <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:16px;margin:16px 0">
                            <p style="color:#e2e8f0;font-size:14px">New Status: <strong style="color:#ef4444">${status}</strong></p>
                            ${adminResponse ? `<p style="color:#94a3b8;font-size:13px;margin-top:8px">Note: ${adminResponse}</p>` : ''}
                        </div>
                    </div>`,
            }).catch(() => { });
        }

        res.json(updatedOrder);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete order
// @route   DELETE /api/orders/:id
// @access  Private
const deleteOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ message: 'Order not found' });
        // Only owner or admin can delete
        if (order.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized' });
        }
        await order.deleteOne();
        res.json({ message: 'Order deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).populate('userId', 'name email');
        if (order) {
            res.json(order);
        } else {
            res.status(404).json({ message: 'Order not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { createOrder, getMyOrders, getOrders, updateOrderStatus, deleteOrder, getOrderById };

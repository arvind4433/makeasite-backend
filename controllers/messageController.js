const Message = require('../models/Message');
const Order = require('../models/Order');
const User = require('../models/User');

// @desc    Send a message
// @route   POST /api/messages
// @access  Private
const sendMessage = async (req, res) => {
    try {
        const { orderId, message, receiverId } = req.body;

        // Ensure the order exists
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        let actualReceiverId = receiverId;

        // If no receiverId provided (client sending to admin)
        if (!actualReceiverId) {
            const adminUser = await User.findOne({ role: 'admin' });
            if (adminUser) {
                actualReceiverId = adminUser._id;
            } else {
                return res.status(400).json({ message: 'Admin not found' });
            }
        }

        const newMessage = new Message({
            senderId: req.user._id,
            receiverId: actualReceiverId,
            orderId,
            message,
        });

        const createdMessage = await newMessage.save();
        res.status(201).json(createdMessage);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get messages by order ID
// @route   GET /api/messages/:orderId
// @access  Private
const getMessages = async (req, res) => {
    try {
        const messages = await Message.find({ orderId: req.params.orderId })
            .populate('senderId', 'name role')
            .sort({ createdAt: 1 });

        // Check if the user is authorized to see these messages
        // In a real app we would check if req.user is part of the order (userId or admin)

        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    sendMessage,
    getMessages
};

import Message from "../models/Message.js";
import Order from "../models/Order.js";
import User from "../models/User.js";

const buildThreadKey = (message, currentUserId) => {
  if (message.order) {
    return `order:${message.order._id || message.order}`;
  }

  const senderId = String(message.sender?._id || message.sender);
  const receiverId = String(message.receiver?._id || message.receiver || "support");
  const otherPartyId = senderId === String(currentUserId) ? receiverId : senderId;
  return `support:${otherPartyId}`;
};

export const sendMessage = async (req, res) => {
  const { receiverId, receiver, orderId, order, message } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({ message: "Message is required" });
  }

  const normalizedOrderId = orderId || order || null;
  let resolvedReceiver = receiverId || receiver || null;

  if (normalizedOrderId) {
    const foundOrder = await Order.findById(normalizedOrderId).populate("client", "_id role");

    if (!foundOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (req.user.role === "admin") {
      resolvedReceiver = foundOrder.client?._id;
    } else if (!resolvedReceiver) {
      const adminUser = await User.findOne({ role: "admin" }).select("_id");
      resolvedReceiver = adminUser?._id || null;
    }
  } else if (!resolvedReceiver) {
    const adminUser = await User.findOne({ role: "admin" }).select("_id");
    resolvedReceiver = adminUser?._id || null;
  }

  const msg = await Message.create({
    sender: req.user._id,
    receiver: resolvedReceiver,
    order: normalizedOrderId,
    message: message.trim()
  });

  const populated = await Message.findById(msg._id)
    .populate("sender", "name role avatar")
    .populate("receiver", "name role avatar")
    .populate("order", "title packageType status");

  res.status(201).json(populated);
};

export const getMessages = async (req, res) => {
  const { orderId } = req.params;

  let query;

  if (orderId === "general") {
    query = {
      order: null,
      $or: [
        { sender: req.user._id },
        { receiver: req.user._id }
      ]
    };
  } else {
    const foundOrder = await Order.findById(orderId);

    if (!foundOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (req.user.role !== "admin" && String(foundOrder.client) !== String(req.user._id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    query = { order: orderId };
  }

  const messages = await Message.find(query)
    .populate("sender", "name role avatar")
    .populate("receiver", "name role avatar")
    .populate("order", "title packageType status")
    .sort({ createdAt: 1 });

  res.json(messages);
};

export const getMessageThreads = async (req, res) => {
  const userId = String(req.user._id);

  let messages;

  if (req.user.role === "admin") {
    messages = await Message.find({})
      .populate("sender", "name role avatar")
      .populate("receiver", "name role avatar")
      .populate("order", "title packageType status client")
      .sort({ createdAt: -1 });
  } else {
    messages = await Message.find({
      $or: [
        { sender: req.user._id },
        { receiver: req.user._id }
      ]
    })
      .populate("sender", "name role avatar")
      .populate("receiver", "name role avatar")
      .populate("order", "title packageType status client")
      .sort({ createdAt: -1 });
  }

  const threadMap = new Map();

  messages.forEach((message) => {
    const key = buildThreadKey(message, userId);

    if (!threadMap.has(key)) {
      const sender = message.sender;
      const receiver = message.receiver;
      const otherParty = String(sender?._id) === userId ? receiver : sender;

      threadMap.set(key, {
        id: key,
        orderId: message.order?._id || null,
        label: message.order?.title || otherParty?.name || "Support Inbox",
        kind: message.order ? "order" : "support",
        otherParty,
        lastMessage: message.message,
        lastMessageAt: message.createdAt,
        unreadCount: 0,
        status: message.order?.status || null
      });
    }

    const thread = threadMap.get(key);
    const isUnreadForCurrentUser =
      !message.isRead &&
      String(message.receiver?._id || message.receiver || "") === userId;

    if (isUnreadForCurrentUser) {
      thread.unreadCount += 1;
    }
  });

  res.json(Array.from(threadMap.values()).sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt)));
};

export const markThreadAsRead = async (req, res) => {
  const { orderId } = req.params;

  const filter = orderId === "general"
    ? {
        order: null,
        receiver: req.user._id,
        isRead: false
      }
    : {
        order: orderId,
        receiver: req.user._id,
        isRead: false
      };

  await Message.updateMany(filter, { $set: { isRead: true } });

  res.json({ message: "Messages marked as read" });
};

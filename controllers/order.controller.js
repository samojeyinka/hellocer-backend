const Order = require('../models/order.model');
const Gig = require('../models/gig.model');
const Chat = require('../models/chat.model');
const User = require('../models/user.model');
const SocketService = require('../services/socket.service');
const NotificationService = require('../services/notification.service');
const EmailService = require('../services/email.service');


exports.getUserOrders = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, type = 'all', page = 1, limit = 20 } = req.query;

    let query = {};

    // Filter by order type
    if (type === 'purchases') {
      // Orders where user is the buyer
      query.clientId = userId;
    } else if (type === 'sales') {
      // Orders where user is seller/hellocian
      query.$or = [
        { gigCreatorId: userId },
        { hellocians: userId }
      ];
    } else {
      // All orders user is involved in
      query.$or = [
        { clientId: userId },
        { gigCreatorId: userId },
        { hellocians: userId }
      ];
    }

    // Filter by status if provided (supports comma-separated multiple statuses)
    if (status) {
      if (status.includes(',')) {
        query.status = { $in: status.split(',').map(s => s.trim()) };
      } else {
        query.status = status;
      }
    }

    const orders = await Order.find(query)
      .populate('gigId', 'title cover')
      .populate('clientId', 'firstName lastName profilePicture')
      .populate('gigCreatorId', 'firstName lastName')
      .populate('hellocians', 'firstName lastName')
      .populate('chatId')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      orders,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Failed to get orders' });
  }
};

// Admin function to get ALL orders
exports.getAllOrders = async (req, res) => {
  try {
    const { status, clientId, gigCreatorId, page = 1, limit = 20 } = req.query;

    let query = {};

    if (status) query.status = status;
    if (clientId) query.clientId = clientId;
    if (gigCreatorId) query.gigCreatorId = gigCreatorId;

    const orders = await Order.find(query)
      .populate('gigId', 'title cover')
      .populate('clientId', 'firstName lastName profilePicture email')
      .populate('gigCreatorId', 'firstName lastName email')
      .populate('hellocians', 'firstName lastName')
      .populate('chatId')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(query);

    // Get order statistics
    const stats = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$price' }
        }
      }
    ]);

    res.json({
      success: true,
      orders,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit)
      },
      stats
    });
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({ error: 'Failed to get orders' });
  }
};

// CORRECT - createOrder is a helper function, not a route
exports.createOrder = async (orderData) => {
  try {
    const {
      gigId,
      img,
      title,
      clientId,
      gigCreatorId,
      hellocians,
      gigCategory,
      payment_method,
      payment_intent,
      pricingPackage,
      price
    } = orderData;

    // Create order
    const order = await Order.create({
      gigId,
      clientId,
      gigCreatorId,
      hellocians,
      title,
      img,
      gigCategory,
      pricingPackage,
      price,
      payment_method,
      payment_intent,
      status: 'pending'
    });

    // Create order chat with all participants
    const participants = [
      clientId,
      gigCreatorId,
      ...hellocians
    ].filter((id, index, self) => 
      self.findIndex(i => i.toString() === id.toString()) === index
    );

    const chat = await Chat.create({
      orderId: order._id,
      participants,
      chatType: 'order',
      lastMessageAt: new Date()
    });

    order.chatId = chat._id;
    await order.save();

    // Update gig sales
    await Gig.findByIdAndUpdate(gigId, { $inc: { sales: 1 } });

    // Get all participant details for notifications
    const participantUsers = await User.find({ _id: { $in: participants } });

    // Send notifications to all participants
    for (const participant of participantUsers) {
      let notificationMessage;
      
      if (participant._id.toString() === clientId.toString()) {
        notificationMessage = `Your order for "${title}" has been created successfully`;
      } else {
        notificationMessage = `New order received for "${title}"`;
      }

      await NotificationService.createNotification({
        userId: participant._id,
        type: 'order_created',
        title: 'New Order',
        message: notificationMessage,
        relatedId: order._id,
        relatedModel: 'Order'
      });

      // Send email notification — differentiate buyer vs service team
      const isClient = participant._id.toString() === clientId.toString();
      await EmailService.sendOrderNotification(
        participant.email,
        participant.firstName,
        {
          isClient,
          orderId: order._id,
          title,
          package: pricingPackage,
          amount: price
        }
      );
    }

    // Emit socket notification
    SocketService.notifyNewOrder({
      orderId: order._id,
      title,
      status: order.status,
      chatId: chat._id
    }, participants);

    // RETURN the order, don't use res
    return order;
    
  } catch (error) {
    console.error('Create order error:', error);
    // THROW the error, don't use res
    throw error;
  }
};



exports.getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id;

    const order = await Order.findById(orderId)
      .populate('gigId')
      .populate('clientId', 'firstName lastName profilePicture email')
      .populate('gigCreatorId', 'firstName lastName profilePicture')
      .populate('hellocians', 'firstName lastName profilePicture')
      .populate('chatId');

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check if user has access to this order
    const hasAccess = 
      order.clientId._id.toString() === userId.toString() ||
      order.gigCreatorId._id.toString() === userId.toString() ||
      order.hellocians.some(h => h._id.toString() === userId.toString()) ||
      ['admin', 'super-admin'].includes(req.user.role);

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ success: true, order });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Failed to get order' });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const userId = req.user._id;

    const order = await Order.findById(orderId)
      .populate('clientId', 'firstName lastName email')
      .populate('gigCreatorId')
      .populate('hellocians');

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check permissions
    const canUpdate = 
      order.gigCreatorId._id.toString() === userId.toString() ||
      ['admin', 'super-admin'].includes(req.user.role);

    if (!canUpdate) {
      return res.status(403).json({ error: 'Not authorized to update this order' });
    }

    order.status = status;
    if (status === 'completed') {
      order.deliveredAt = new Date();
    }
    await order.save();

    // Notify all participants
    const participants = [
      order.clientId._id,
      order.gigCreatorId._id,
      ...order.hellocians.map(h => h._id)
    ];

    for (const participantId of participants) {
      await NotificationService.createNotification({
        userId: participantId,
        type: 'order_updated',
        title: 'Order Status Updated',
        message: `Order "${order.title}" status changed to ${status}`,
        relatedId: order._id,
        relatedModel: 'Order'
      });
    }

    SocketService.notifyOrderUpdate(orderId, { status }, participants);

    res.json({ success: true, order });
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({ error: 'Failed to update order' });
  }
};

exports.cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    const userId = req.user._id;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Only client or admin can cancel
    const canCancel = 
      order.clientId.toString() === userId.toString() ||
      ['admin', 'super-admin'].includes(req.user.role);

    if (!canCancel) {
      return res.status(403).json({ error: 'Not authorized to cancel this order' });
    }

    if (order.status === 'completed') {
      return res.status(400).json({ error: 'Cannot cancel completed order' });
    }

    order.status = 'cancelled';
    await order.save();

    // Notify participants
    const participants = [order.clientId, order.gigCreatorId, ...order.hellocians];
    
    for (const participantId of participants) {
      await NotificationService.createNotification({
        userId: participantId,
        type: 'order_cancelled',
        title: 'Order Cancelled',
        message: `Order "${order.title}" has been cancelled${reason ? `: ${reason}` : ''}`,
        relatedId: order._id,
        relatedModel: 'Order'
      });
    }

    res.json({ success: true, message: 'Order cancelled successfully' });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
};

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
      .populate('clientId', 'firstName lastName profilePicture country timeZone')
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

exports.getClientActivityStats = async (req, res) => {
  try {
    const userId = req.user._id;

    // We will fetch all orders for the client created in the current year, and bin them in memory.
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const orders = await Order.find({
      clientId: userId,
      createdAt: { $gte: startOfYear }
    }).select('createdAt price status');

    // Helper to get start and end dates of current periods
    const endOfWeek = new Date();
    const startOfWeek = new Date();
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Bin arrays
    const weekData = [
      { day: 'S', value: 0, projects: 0, label: 'Sunday', details: '0 projects, $0 spent' },
      { day: 'M', value: 0, projects: 0, label: 'Monday', details: '0 projects, $0 spent' },
      { day: 'T', value: 0, projects: 0, label: 'Tuesday', details: '0 projects, $0 spent' },
      { day: 'W', value: 0, projects: 0, label: 'Wednesday', details: '0 projects, $0 spent' },
      { day: 'T', value: 0, projects: 0, label: 'Thursday', details: '0 projects, $0 spent' },
      { day: 'F', value: 0, projects: 0, label: 'Friday', details: '0 projects, $0 spent' },
      { day: 'S', value: 0, projects: 0, label: 'Saturday', details: '0 projects, $0 spent' }
    ];

    const monthData = [
      { day: 'W1', value: 0, projects: 0, label: 'Week 1', details: '0 projects, $0 spent' },
      { day: 'W2', value: 0, projects: 0, label: 'Week 2', details: '0 projects, $0 spent' },
      { day: 'W3', value: 0, projects: 0, label: 'Week 3', details: '0 projects, $0 spent' },
      { day: 'W4', value: 0, projects: 0, label: 'Week 4', details: '0 projects, $0 spent' }
    ];

    const quarterMonths = [];
    const currentQtrStartMonth = Math.floor(now.getMonth() / 3) * 3;
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    for(let i = 0; i < 3; i++) {
        quarterMonths.push({ 
          day: monthNames[currentQtrStartMonth + i], 
          value: 0, projects: 0, label: monthNames[currentQtrStartMonth + i], details: '0 projects, $0 spent',
          monthIndex: currentQtrStartMonth + i
        });
    }

    const yearData = [
      { day: 'Q1', value: 0, projects: 0, label: 'Quarter 1', details: '0 projects, $0 spent' },
      { day: 'Q2', value: 0, projects: 0, label: 'Quarter 2', details: '0 projects, $0 spent' },
      { day: 'Q3', value: 0, projects: 0, label: 'Quarter 3', details: '0 projects, $0 spent' },
      { day: 'Q4', value: 0, projects: 0, label: 'Quarter 4', details: '0 projects, $0 spent' }
    ];

    orders.forEach(order => {
      const date = new Date(order.createdAt);
      const amount = parseFloat(order.price) || 0;

      // This Week
      if (date >= startOfWeek) {
        let dIndex = date.getDay();
        weekData[dIndex].value += amount;
        weekData[dIndex].projects += 1;
        weekData[dIndex].details = `${weekData[dIndex].projects} projects, $${weekData[dIndex].value.toFixed(2)} spent`;
      }

      // This Month
      if (date >= startOfMonth) {
        // week 1 is 1-7, week 2 is 8-14, week 3 is 15-21, week 4 is 22+
        let dom = date.getDate();
        let wIndex = 0;
        if (dom > 7) wIndex = 1;
        if (dom > 14) wIndex = 2;
        if (dom > 21) wIndex = 3;
        monthData[wIndex].value += amount;
        monthData[wIndex].projects += 1;
        monthData[wIndex].details = `${monthData[wIndex].projects} projects, $${monthData[wIndex].value.toFixed(2)} spent`;
      }

      // This Quarter
      const mIndex = date.getMonth();
      if (mIndex >= currentQtrStartMonth && mIndex < currentQtrStartMonth + 3) {
        let qmIndex = mIndex - currentQtrStartMonth;
        quarterMonths[qmIndex].value += amount;
        quarterMonths[qmIndex].projects += 1;
        quarterMonths[qmIndex].details = `${quarterMonths[qmIndex].projects} projects, $${quarterMonths[qmIndex].value.toFixed(2)} spent`;
      }

      // This Year
      let qIndex = Math.floor(mIndex / 3);
      yearData[qIndex].value += amount;
      yearData[qIndex].projects += 1;
      yearData[qIndex].details = `${yearData[qIndex].projects} projects, $${yearData[qIndex].value.toFixed(2)} spent`;
    });

    res.json({
      success: true,
      stats: {
        'This Week': weekData,
        'This Month': monthData,
        'This Quarter': quarterMonths.map(q => ({
            day: q.day, value: q.value, projects: q.projects, label: q.label, details: q.details
        })),
        'This Year': yearData
      }
    });

  } catch (error) {
    console.error('Get client activity stats error:', error);
    res.status(500).json({ error: 'Failed to get client activity stats' });
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
      .populate('hellocians', 'firstName lastName username')
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

    // Find gig to get delivery timeframe
    const gig = await Gig.findById(gigId);
    if (!gig) throw new Error('Gig not found');

    const selectedPackage = gig.pricing[pricingPackage];
    const deliveryTimeframe = selectedPackage?.deliveryTimeframe || "3 days"; // default if not found

    // Calculate delivery date based on timeframe string (e.g., "3 days", "1 week")
    let deliveryDate = new Date();
    const timeframeValue = parseInt(deliveryTimeframe);
    if (deliveryTimeframe.toLowerCase().includes('day')) {
      deliveryDate.setDate(deliveryDate.getDate() + timeframeValue);
    } else if (deliveryTimeframe.toLowerCase().includes('week')) {
      deliveryDate.setDate(deliveryDate.getDate() + (timeframeValue * 7));
    } else if (deliveryTimeframe.toLowerCase().includes('month')) {
      deliveryDate.setMonth(deliveryDate.getMonth() + timeframeValue);
    } else {
      // Default to 3 days if format is unknown
      deliveryDate.setDate(deliveryDate.getDate() + 3);
    }

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
      status: 'pending',
      deliveryTimeframe,
      deliveryDate
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
      .populate('clientId', 'firstName lastName profilePicture email country timeZone')
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
      
      // Send review prompt email to client
      if (order.clientId?.email) {
        await EmailService.sendReviewPromptEmail(
          order.clientId.email,
          order.clientId.firstName,
          {
            orderId: order._id.toString(),
            title: order.title
          }
        );
      }
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


exports.extendOrderDeliveryTime = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { newDeliveryDate, reason } = req.body;

    if (!newDeliveryDate) {
      return res.status(400).json({ error: 'New delivery date is required' });
    }

    const order = await Order.findById(orderId)
      .populate('clientId', 'firstName lastName email')
      .populate('gigCreatorId')
      .populate('hellocians');

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const oldDate = order.deliveryDate;
    order.deliveryDate = new Date(newDeliveryDate);
    await order.save();

    // Notify all participants via Email & Sockets
    const participants = [
      { user: order.clientId, role: 'client' },
      { user: order.gigCreatorId, role: 'creator' },
      ...order.hellocians.map(h => ({ user: h, role: 'hellocian' }))
    ];

    for (const p of participants) {
      if (p.user?.email) {
        await EmailService.sendOrderExtensionEmail(
          p.user.email,
          p.user.firstName,
          {
            orderId: order._id.toString(),
            title: order.title,
            oldDate,
            newDate: order.deliveryDate,
            reason
          }
        );
      }
    }

    const participantIds = participants.map(p => p.user._id);
    SocketService.notifyOrderUpdate(orderId, { deliveryDate: order.deliveryDate }, participantIds);

    res.json({ 
      success: true, 
      message: 'Delivery date extended successfully',
      order 
    });
  } catch (error) {
    console.error('Extend order error:', error);
    res.status(500).json({ error: 'Failed to extend order delivery time' });
  }
};

exports.updateOrderHellocians = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { hellocianIds } = req.body;

    if (!Array.isArray(hellocianIds)) {
      return res.status(400).json({ error: 'hellocianIds must be an array' });
    }

    const order = await Order.findById(orderId)
      .populate('clientId')
      .populate('gigCreatorId')
      .populate('hellocians');

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const oldHellocianIds = order.hellocians.map(h => h._id.toString());
    const newHellocianIds = hellocianIds.map(id => id.toString());

    // Find added and removed Hellocians
    const addedIds = newHellocianIds.filter(id => !oldHellocianIds.includes(id));
    const removedIds = oldHellocianIds.filter(id => !newHellocianIds.includes(id));

    // Update order
    order.hellocians = hellocianIds;
    await order.save();

    // Sync Chat participants
    const chat = await Chat.findById(order.chatId);
    if (chat) {
      const baseParticipants = [order.clientId, order.gigCreatorId].map(u => u._id.toString());
      chat.participants = [...new Set([...baseParticipants, ...newHellocianIds])];
      await chat.save();
    }

    // Send Emails to added Hellocians
    if (addedIds.length > 0) {
      const addedUsers = await User.find({ _id: { $in: addedIds } });
      for (const user of addedUsers) {
        await EmailService.sendOrderAssignmentEmail(user.email, user.firstName, {
          orderId: order._id.toString(),
          title: order.title
        });
      }
    }

    // Send Emails to removed Hellocians
    if (removedIds.length > 0) {
      const removedUsers = await User.find({ _id: { $in: removedIds } });
      for (const user of removedUsers) {
        await EmailService.sendOrderRemovalEmail(user.email, user.firstName, {
          orderId: order._id.toString(),
          title: order.title
        });
      }
    }

    // Emit socket update to all participants (old and new)
    const allAffectedParticipants = [...new Set([...oldHellocianIds, ...newHellocianIds, order.clientId._id.toString(), order.gigCreatorId._id.toString()])];
    SocketService.notifyOrderUpdate(orderId, { hellocians: hellocianIds }, allAffectedParticipants);

    const updatedOrder = await Order.findById(orderId).populate('hellocians', 'firstName lastName username');

    res.json({
      success: true,
      message: 'Hellocians updated successfully',
      order: updatedOrder
    });
  } catch (error) {
    console.error('Update order hellocians error:', error);
    res.status(500).json({ error: 'Failed to update Hellocians' });
  }
};

exports.remindReview = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await Order.findById(orderId).populate('clientId');
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    if (order.status !== 'completed') {
      return res.status(400).json({ error: 'Can only remind for completed orders' });
    }
    
    if (order.isReviewed) {
      return res.status(400).json({ error: 'Order already reviewed' });
    }
    
    if (!order.clientId?.email) {
      console.error('Review reminder failed: Client email missing', { orderId: order._id, clientId: order.clientId?._id });
      return res.status(400).json({ error: 'Client email not found. Cannot send reminder.' });
    }

    try {
      const info = await EmailService.sendReviewReminderEmail(
        order.clientId.email,
        order.clientId.firstName,
        {
          orderId: order._id.toString(),
          title: order.title
        }
      );
      
      console.log('Review reminder sent:', info?.messageId || 'Success');
      res.json({ success: true, message: 'Review reminder sent successfully' });
    } catch (emailError) {
      console.error('EmailService.sendReviewReminderEmail failed:', emailError);
      return res.status(500).json({ error: 'Failed to send email. Please check SMTP settings.' });
    }
  } catch (error) {
    console.error('Remind review controller error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.requestAdditionalPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { amount, description } = req.body;
    
    if (!amount || !description) {
      return res.status(400).json({ error: 'Amount and description are required' });
    }
    
    const order = await Order.findById(orderId).populate('clientId');
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const newAdditionalPayment = {
      amount,
      description,
      status: 'pending'
    };
    
    order.additionalPayments.push(newAdditionalPayment);
    await order.save();
    
    const paymentIndex = order.additionalPayments.length - 1;
    
    if (order.clientId?.email) {
      await EmailService.sendAdditionalPaymentRequestEmail(
        order.clientId.email,
        order.clientId.firstName,
        {
          orderId: order._id.toString(),
          title: order.title,
          amount,
          description,
          paymentIndex
        }
      );
    }
    
    // Also send socket notification to the client
    SocketService.notifyOrderUpdate(orderId, { additionalPayments: order.additionalPayments }, [order.clientId._id]);
    
    // Notify the client via NotificationService
    // disabled per user request
    // await NotificationService.createNotification({ ... });
    
    res.json({ success: true, message: 'Additional payment requested successfully', order });
  } catch (error) {
    console.error('Request additional payment error:', error);
    res.status(500).json({ error: 'Failed to request additional payment' });
  }
};

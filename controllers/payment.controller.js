const PaymentService = require('../services/payment/paymentService');
const Gig = require('../models/gig.model');
const { createOrder } = require('./order.controller');
const Payment = require('../models/payment.model');
const Order = require('../models/order.model');
const NotificationService = require('../services/notification.service');

exports.createPayment = async (req, res) => {
  try {
    const { provider = 'paypal', gigId, pricingPackage } = req.body;

    if (!gigId || !pricingPackage) {
      return res.status(400).json({ error: 'gigId and pricingPackage are required' });
    }

    const gig = await Gig.findById(gigId);
    if (!gig) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    if (!gig.isAcceptingOrders) {
      return res.status(400).json({ error: 'This gig is not accepting orders at the moment' });
    }

    // Always derive amount server-side — never trust the client
    const amount = gig.pricing[pricingPackage]?.price;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: `Invalid or missing price for package: ${pricingPackage}` });
    }

    const returnUrl = `${process.env.FRONTEND_URL}/payment/success?gigId=${gigId}&package=${pricingPackage}`;
    const cancelUrl = `${process.env.FRONTEND_URL}/payment/cancel?gigId=${gigId}&package=${pricingPackage}`;
    const description = `Payment for ${gig.title} - ${pricingPackage} package`;

    const result = await PaymentService.createPayment(
      provider,
      amount,
      returnUrl,
      cancelUrl,
      description
    );

    res.json({
      success: true,
      paymentId: result.paymentId,
      approvalUrl: result.approvalUrl,
      amount,
      currency: 'USD'
    });
  } catch (error) {
    console.error('Payment creation error:', error);
    res.status(500).json({ error: 'Failed to create payment', details: error.message });
  }
};

exports.executePayment = async (req, res) => {
  try {
    const {
      paymentId,
      PayerID,
      pricingPackage,
      gigId,
      provider = 'paypal'
    } = req.body;

    if (!paymentId || !PayerID || !gigId || !pricingPackage) {
      return res.status(400).json({ error: 'paymentId, PayerID, gigId and pricingPackage are required' });
    }

    const duplicate = await PaymentService.checkDuplicatePayment(paymentId);
    if (duplicate) {
      return res.status(400).json({ error: 'This payment has already been processed' });
    }

    const gig = await Gig.findById(gigId)
      .populate('category', 'name')
      .populate('hellocians', '_id firstName lastName email')
      .populate('creator', '_id firstName lastName email');

    if (!gig) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    const expectedAmount = gig.pricing[pricingPackage]?.price;
    if (!expectedAmount) {
      return res.status(400).json({ error: `Invalid package: ${pricingPackage}` });
    }

    const result = await PaymentService.executePayment(provider, paymentId, PayerID);

    // Use tolerance-based comparison to avoid float precision issues
    const amountMatch = Math.abs(parseFloat(result.amount) - expectedAmount) < 0.01;

    if (result.status === 'approved' && amountMatch) {
      const paymentRecord = await PaymentService.recordPayment({
        amount: result.amount,
        email: req.user.email,
        full_name: `${req.user.firstName} ${req.user.lastName}`,
        clientId: req.user._id,
        gigId: gig._id,
        pricingPackage,
        status: result.status,
        payment_method: provider,
        payment_intent: result.paymentIntent,
        currency: result.currency
      });

      const order = await createOrder({
        gigId: gig._id,
        img: gig.cover,
        title: gig.title,
        clientId: req.user._id,
        gigCreatorId: gig.creator._id,
        hellocians: gig.hellocians.map(h => h._id),
        gigCategory: gig.category.map(cat => cat.name),
        payment_method: provider,
        payment_intent: result.paymentIntent,
        pricingPackage,
        price: result.amount
      });

      await PaymentService.updatePaymentStatus(result.paymentIntent, 'approved', order._id);

      // Notify Client and Team about new order
      const clientNotification = {
        userId: req.user._id,
        type: 'order_created',
        title: 'Order Placed Successfully',
        message: `Your order for "${gig.title}" has been placed.`,
        relatedId: order._id,
        relatedModel: 'Order'
      };

      const teamNotifications = [
        {
          userId: gig.creator._id,
          type: 'order_created',
          title: 'New Order Received',
          message: `A new order has been placed for your gig "${gig.title}".`,
          relatedId: order._id,
          relatedModel: 'Order'
        },
        ...gig.hellocians.map(h => ({
          userId: h._id,
          type: 'order_created',
          title: 'New Order Assigned',
          message: `You have been assigned to a new order: "${gig.title}".`,
          relatedId: order._id,
          relatedModel: 'Order'
        }))
      ];

      await NotificationService.createNotification(clientNotification);
      await NotificationService.createBulkNotifications(teamNotifications);

      res.json({
        success: true,
        message: 'Payment successful',
        orderId: order._id,
        chatId: order.chatId,
        transaction: {
          amount: result.amount,
          currency: result.currency
        }
      });
    } else {
      res.status(400).json({
        error: 'Payment verification failed',
        details: `Status: ${result.status}, Amount received: ${result.amount}, Expected: ${expectedAmount}`
      });
    }
  } catch (error) {
    console.error('Payment execution error:', error);
    res.status(500).json({ error: 'Failed to process payment', details: error.message });
  }
};

exports.refundPayment = async (req, res) => {
  try {
    const { orderId, amount, provider = 'paypal' } = req.body;

    const payment = await Payment.findOne({ orderId });
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const refund = await PaymentService.refundPayment(
      provider,
      payment.payment_intent,
      amount
    );

    await PaymentService.updatePaymentStatus(payment.payment_intent, 'refunded');

    res.json({
      success: true,
      message: 'Refund processed successfully',
      refund
    });
  } catch (error) {
    console.error('Refund error:', error);
    res.status(500).json({ error: 'Failed to process refund', details: error.message });
  }
};

exports.createAdditionalPayment = async (req, res) => {
  try {
    const { provider = 'paypal', orderId, paymentIndex } = req.body;

    if (!orderId || paymentIndex === undefined) {
      return res.status(400).json({ error: 'orderId and paymentIndex are required' });
    }

    const order = await Order.findById(orderId).populate('gigId');
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const paymentInfo = order.additionalPayments[paymentIndex];
    if (!paymentInfo) {
      return res.status(404).json({ error: 'Additional payment request not found' });
    }

    if (paymentInfo.status === 'paid') {
      return res.status(400).json({ error: 'This payment has already been completed' });
    }

    const amount = paymentInfo.amount;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount for payment' });
    }

    const returnUrl = `${process.env.FRONTEND_URL}/payment/order-success?orderId=${orderId}&paymentIndex=${paymentIndex}`;
    const cancelUrl = `${process.env.FRONTEND_URL}/payment/order/${orderId}/${paymentIndex}`;
    const description = `Additional Payment: ${paymentInfo.description}`;

    const result = await PaymentService.createPayment(
      provider,
      amount,
      returnUrl,
      cancelUrl,
      description
    );

    res.json({
      success: true,
      paymentId: result.paymentId,
      approvalUrl: result.approvalUrl,
      amount,
      currency: 'USD'
    });
  } catch (error) {
    console.error('Additional payment creation error:', error);
    res.status(500).json({ error: 'Failed to create payment', details: error.message });
  }
};

exports.executeAdditionalPayment = async (req, res) => {
  try {
    const {
      paymentId,
      PayerID,
      orderId,
      paymentIndex,
      provider = 'paypal'
    } = req.body;

    if (!paymentId || !PayerID || !orderId || paymentIndex === undefined) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const duplicate = await PaymentService.checkDuplicatePayment(paymentId);
    if (duplicate) {
      return res.status(400).json({ error: 'This payment has already been processed' });
    }

    const order = await Order.findById(orderId)
      .populate('gigId')
      .populate('gigCreatorId')
      .populate('hellocians');
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const paymentInfo = order.additionalPayments[paymentIndex];
    if (!paymentInfo) {
      return res.status(404).json({ error: 'Payment info not found' });
    }

    if (paymentInfo.status === 'paid') {
      return res.status(400).json({ error: 'This payment has already been completed' });
    }

    const expectedAmount = paymentInfo.amount;

    const result = await PaymentService.executePayment(provider, paymentId, PayerID);

    const amountMatch = Math.abs(parseFloat(result.amount) - expectedAmount) < 0.01;

    if (result.status === 'approved' && amountMatch) {
      
      const paymentRecord = await PaymentService.recordPayment({
        amount: result.amount,
        email: req.user.email,
        full_name: `${req.user.firstName} ${req.user.lastName}`,
        clientId: req.user._id,
        gigId: order.gigId._id,
        pricingPackage: 'additional',
        status: result.status,
        payment_method: provider,
        payment_intent: result.paymentIntent,
        currency: result.currency,
        orderId: order._id
      });
      
      paymentInfo.status = 'paid';
      paymentInfo.payment_intent = result.paymentIntent;
      await order.save();
      
      // Notify via socket using SocketService manually since SocketService is imported
      // We will require it
      const SocketService = require('../services/socket.service');
      const EmailService = require('../services/email.service');
      const NotificationService = require('../services/notification.service');
      
      SocketService.notifyOrderUpdate(order._id.toString(), { additionalPayments: order.additionalPayments }, [order.clientId?._id?.toString() || order.clientId.toString(), order.gigCreatorId._id.toString(), ...order.hellocians.map(h => h._id.toString())]);

      // Persistent Notifications
      const clientNotif = {
        userId: req.user._id,
        type: 'payment_received',
        title: 'Payment Successful',
        message: `Your additional payment of $${result.amount} for "${order.title}" was successful.`,
        relatedId: order._id,
        relatedModel: 'Order'
      };

      const teamNotifs = [
        {
          userId: order.gigCreatorId._id,
          type: 'payment_received',
          title: 'Additional Payment Received',
          message: `An additional payment of $${result.amount} has been received for "${order.title}".`,
          relatedId: order._id,
          relatedModel: 'Order'
        },
        ...order.hellocians.map(h => ({
          userId: h._id,
          type: 'payment_received',
          title: 'Additional Payment Received',
          message: `An additional payment of $${result.amount} has been received for "${order.title}".`,
          relatedId: order._id,
          relatedModel: 'Order'
        }))
      ];

      await NotificationService.createNotification(clientNotif);
      await NotificationService.createBulkNotifications(teamNotifs);

      if (req.user.email) {
        await EmailService.sendAdditionalPaymentSuccessEmail(
          req.user.email,
          req.user.firstName,
          {
            orderId: order._id.toString(),
            title: order.title,
            amount: result.amount
          }
        );
      }

      // Notify the gig creator
      if (order.gigCreatorId?.email) {
        await EmailService.sendAdditionalPaymentTeamNotification(
          order.gigCreatorId.email,
          order.gigCreatorId.firstName,
          {
            orderId: order._id.toString(),
            title: order.title,
            amount: result.amount
          }
        );
      }

      // Notify all hellocians
      if (order.hellocians && order.hellocians.length > 0) {
        for (const hellocian of order.hellocians) {
          if (hellocian.email) {
            await EmailService.sendAdditionalPaymentTeamNotification(
              hellocian.email,
              hellocian.firstName,
              {
                orderId: order._id.toString(),
                title: order.title,
                amount: result.amount
              }
            );
          }
        }
      }

      res.json({
        success: true,
        message: 'Additional payment successful',
        orderId: order._id,
        transaction: {
          amount: result.amount,
          currency: result.currency
        }
      });
    } else {
      res.status(400).json({
        error: 'Payment verification failed',
        details: `Status: ${result.status}, Amount received: ${result.amount}, Expected: ${expectedAmount}`
      });
    }
  } catch (error) {
    console.error('Additional payment execution error:', error);
    res.status(500).json({ error: 'Failed to process payment', details: error.message });
  }
};
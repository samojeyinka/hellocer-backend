const PaymentService = require('../services/payment/paymentService');
const Gig = require('../models/gig.model');
const { createOrder } = require('./order.controller');
const Payment = require('../models/payment.model')

exports.createPayment = async (req, res) => {
  try {
    const { amount, provider = 'paypal', gigId, pricingPackage } = req.body;

    const gig = await Gig.findById(gigId);
    if (!gig) {
      return res.status(404).json({ error: "Gig not found" });
    }

    if (!gig.isAcceptingOrders) {
      return res.status(400).json({ error: "This gig is not accepting orders at the moment" });
    }

    const expectedAmount = gig.pricing[pricingPackage]?.price;
    if (!expectedAmount || amount !== expectedAmount) {
      return res.status(400).json({ error: "Invalid amount for selected package" });
    }

    const returnUrl = `${process.env.FRONTEND_URL}/payment/success`;
    const cancelUrl = `${process.env.FRONTEND_URL}/payment/cancel`;
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
      approvalUrl: result.approvalUrl
    });
  } catch (error) {
    console.error('Payment creation error:', error);
    res.status(500).json({ error: "Failed to create payment", details: error.message });
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

    const duplicate = await PaymentService.checkDuplicatePayment(paymentId);
    if (duplicate) {
      return res.status(400).json({ error: "This payment has already been processed" });
    }

    const gig = await Gig.findById(gigId).populate('category', 'name').populate('hellocians');
    if (!gig) {
      return res.status(404).json({ error: "Gig not found" });
    }

    const expectedAmount = gig.pricing[pricingPackage]?.price;
    const result = await PaymentService.executePayment(provider, paymentId, PayerID);

    if (result.status === 'approved' && parseFloat(result.amount) === expectedAmount) {
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
        gigCreatorId: gig.creator,
        hellocians: gig.hellocians.map(h => h._id),
        gigCategory: gig.category.map(cat => cat.name),
        payment_method: provider,
        payment_intent: result.paymentIntent,
        pricingPackage,
        price: result.amount
      });

      await PaymentService.updatePaymentStatus(result.paymentIntent, 'approved', order._id);

      res.json({
        success: true,
        message: "Payment successful",
        orderId: order._id,
        transaction: {
          amount: result.amount,
          currency: result.currency
        }
      });
    } else {
      res.status(400).json({
        error: "Payment verification failed",
        details: "Amount mismatch or payment not approved"
      });
    }
  } catch (error) {
    console.error('Payment execution error:', error);
    res.status(500).json({ error: "Failed to process payment", details: error.message });
  }
};

exports.refundPayment = async (req, res) => {
  try {
    const { orderId, amount, provider = 'paypal' } = req.body;
    
    const payment = await Payment.findOne({ orderId });
    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    const refund = await PaymentService.refundPayment(
      provider,
      payment.payment_intent,
      amount
    );

    await PaymentService.updatePaymentStatus(payment.payment_intent, 'refunded');

    res.json({
      success: true,
      message: "Refund processed successfully",
      refund
    });
  } catch (error) {
    console.error('Refund error:', error);
    res.status(500).json({ error: "Failed to process refund", details: error.message });
  }
};
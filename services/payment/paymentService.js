const paymentProviders = require('./providers');
const Payment = require('../../models/payment.model');

class PaymentService {
  getProvider(providerName) {
    const provider = paymentProviders[providerName.toLowerCase()];
    if (!provider) {
      throw new Error(`Payment provider ${providerName} not supported`);
    }
    return provider;
  }

  async createPayment(providerName, amount, returnUrl, cancelUrl, description) {
    const provider = this.getProvider(providerName);
    return await provider.createPayment(amount, returnUrl, cancelUrl, description);
  }

  async executePayment(providerName, paymentId, payerId) {
    const provider = this.getProvider(providerName);
    return await provider.executePayment(paymentId, payerId);
  }

  async refundPayment(providerName, transactionId, amount) {
    const provider = this.getProvider(providerName);
    return await provider.refundPayment(transactionId, amount);
  }

  async recordPayment(paymentData) {
    const payment = new Payment(paymentData);
    return await payment.save();
  }

  async checkDuplicatePayment(paymentIntent) {
    return await Payment.findOne({ payment_intent: paymentIntent });
  }

  async updatePaymentStatus(paymentIntent, status, orderId = null) {
    const updateData = { status };
    if (orderId) updateData.orderId = orderId;
    
    return await Payment.findOneAndUpdate(
      { payment_intent: paymentIntent },
      updateData,
      { new: true }
    );
  }
}

module.exports = new PaymentService();
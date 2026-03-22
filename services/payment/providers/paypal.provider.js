const paypal = require("paypal-rest-sdk");

class PayPalProvider {
  constructor() {
    paypal.configure({
      mode: process.env.PAYPAL_MODE || 'sandbox',
      client_id:process.env.PAYPAL_CLIENT_ID,
      client_secret:process.env.PAYPAL_CLIENT_SECRET
    });
  }

  async createPayment(amount, returnUrl, cancelUrl, description) {
    const paymentData = {
      intent: 'sale',
      payer: {
        payment_method: 'paypal'
      },
      redirect_urls: {
        return_url: returnUrl,
        cancel_url: cancelUrl
      },
      transactions: [{
        amount: {
          total: amount.toFixed(2),
          currency: 'USD'
        },
        description: description || 'Payment for service'
      }]
    };

    return new Promise((resolve, reject) => {
      paypal.payment.create(paymentData, (error, payment) => {
        if (error) {
          reject(error);
        } else {
          const approvalUrl = payment.links.find(link => link.rel === 'approval_url')?.href;
          if (!approvalUrl) {
            reject(new Error('Approval URL not found'));
          }
          resolve({
            paymentId: payment.id,
            approvalUrl,
            payment
          });
        }
      });
    });
  }

  async executePayment(paymentId, payerId) {
    return new Promise((resolve, reject) => {
      paypal.payment.execute(paymentId, { payer_id: payerId }, (error, payment) => {
        if (error) {
          reject(error);
        } else {
          resolve({
            status: payment.state,
            amount: payment.transactions[0].amount.total,
            currency: payment.transactions[0].amount.currency,
            paymentIntent: payment.id,
            rawPayment: payment
          });
        }
      });
    });
  }

  async refundPayment(saleId, amount) {
    return new Promise((resolve, reject) => {
      const refundData = amount ? { amount: { total: amount.toFixed(2), currency: 'USD' } } : {};
      
      paypal.sale.refund(saleId, refundData, (error, refund) => {
        if (error) {
          reject(error);
        } else {
          resolve({
            refundId: refund.id,
            status: refund.state,
            amount: refund.amount.total
          });
        }
      });
    });
  }

  async getPaymentDetails(paymentId) {
    return new Promise((resolve, reject) => {
      paypal.payment.get(paymentId, (error, payment) => {
        if (error) {
          reject(error);
        } else {
          resolve(payment);
        }
      });
    });
  }
}

module.exports = new PayPalProvider();
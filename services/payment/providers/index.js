const PayPalProvider = require('./paypal.provider');
// const StripeProvider = require('./stripe.provider'); // Future
// const FlutterwaveProvider = require('./flutterwave.provider'); // Future

const paymentProviders = {
  paypal: PayPalProvider,
  // stripe: StripeProvider, // Add when ready
  // flutterwave: FlutterwaveProvider // Add when ready
};

module.exports = paymentProviders;
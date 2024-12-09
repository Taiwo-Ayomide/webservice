const router = require('express').Router();
const dotenv = require('dotenv');
const axios = require('axios');
const Paystack = require('paystack');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const paystack = new Paystack(process.env.PAYSTACK_SECRET_KEY);
dotenv.config();

// const PAYSTACK_SECRET_KEY = 'sk_test_e6f5d64907d1ae611b1aacb382a65ffc372e2a32';


router.post('/api/remita/initialize', async (req, res) => {
  const { amount, email } = req.body;

  try {
    const response = await axios.post('https://demo.remita.net/remita/exapp/api/v1/send/api/echannelsvc/merchant/api/paymentinit', {
      serviceTypeId: process.env.REMITA_SERVICE_TYPE_ID,
      amount: amount,
      orderId: 'order-id',
      payerName: 'payer-name',
      payerEmail: email,
      payerPhone: 'payer-phone',
      description: 'Payment for goods'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `remitaConsumerKey=${process.env.REMITA_PUBLIC_KEY}, remitaConsumerToken=${process.env.REMITA_SECRET_KEY}`
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).send('Payment initialization failed');
  }
});

router.post('/api/remita/verify', async (req, res) => {
  const { transactionId } = req.body;

  try {
    const response = await axios.get(`https://demo.remita.net/remita/exapp/api/v1/send/api/echannelsvc/merchant/api/payment/status/${transactionId}/${process.env.REMITA_MERCHANT_ID}/${process.env.REMITA_SERVICE_TYPE_ID}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `remitaConsumerKey=${process.env.REMITA_PUBLIC_KEY}, remitaConsumerToken=${process.env.REMITA_SECRET_KEY}`
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).send('Payment verification failed');
  }
});

router.post('/initiate', async (req, res) => {
  const { email, amount, paymentMethod } = req.body;

  try {
      const response = await axios.post(
          'https://api.paystack.co/transaction/initialize',
          { email, amount: amount * 100, channels: [paymentMethod] },
          { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
      );
      res.json(response.data.data);
  } catch (error) {
      res.status(500).json({ error: error.message });
  }
});


router.post('/initiatePaystackPayment', async (req, res) => {
    const { email, amount } = req.body;
    try {
        const response = await paystack.transaction.initialize({
            email,
            amount: amount * 100,
            callback_url: 'http://localhost:5000/payment-verify'
        });
        res.status(200).json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/verifyPaystackPayment/:reference', async (req, res) => {
    const { reference } = req.params;
    try {
        const response = await paystack.transaction.verify(reference);
        res.status(200).json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/createStripePaymentIntent', async (req, res) => {
    const { amount } = req.body;
    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount * 100,
            currency: 'ngn',
        });
        res.status(200).json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router
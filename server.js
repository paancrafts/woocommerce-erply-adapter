
require('dotenv').config();

const express = require('express');
const morgan = require('morgan')
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const { URLSearchParams } = require('url');
const CronJob = require('cron').CronJob;
const LastSync = require('./models/LastSync');
const mongoose = require('mongoose');
const app = express();
const {
  woocommRestApi,
  erplyWooCommerceProductsSync
} = require('./helpers/WcApi');
const { 
  verifyErplyUser,
  sendOrderToErply,
  erplyWooCommerceCategoriesSync,
  erplyWooCommerceBrandsSync
} = require('./helpers/Erply');

//Set up default mongoose connection
const mongoDB = `mongodb://${process.env.DB_USER}:${process.env.DB_PWD}@${process.env.DB_URL}`;
mongoose.connect(mongoDB, { useNewUrlParser: true, useUnifiedTopology: true });
const LastSyncSchema = new mongoose.Schema({ requestUnixTime: { type: Number } });
const LastSync = mongoose.model('LastSync', LastSyncSchema);
const db = mongoose.connection;

app.use(bodyParser.json())
app.use(morgan('combined'));

const ERPLY_URL = `https://${process.env.ERPLY_CC}${process.env.ERPLY_PATH}`;
const PORT = 3131;

let sessionKey;

/* * * * * * *
 * CRON JOBS *
 * * * * * * */

// Erply-WooCommerce categories, attributes and products sync every minute
new CronJob('0 */2 * * * *', function() {
  let current = 0;
  let to = 30;
  function getUser() {
    if (current == to) {
      clearInterval(timerId);
    }
      verifyErplyUser()
      .then((data) => {
        if (data.status.errorCode >= 1000 && data.status.errorCode <= 1009) {
          console.log('Server down. Error code: ' + data.status.errorCode + '. Retry: ' + current);
          current++;
          verifyErplyUser()
        }
        if (data.status.errorCode === 0) {
          sessionKey = data.records[0].sessionKey;
          clearInterval(timerId);
          erplyWooCommerceCategoriesSync()
          .then(data => {
            erplyWooCommerceBrandsSync()
            .then((brandSyncResponse) => {
              erplyWooCommerceProductsSync(undefined)
              .then(() => {})
              .catch(err => console.log(err));
            })
            .catch(err => console.log(err));
          })
          .catch(err => console.log(err));
        }
      })
      .catch(err => console.log(err));
  }
  getUser();
  let timerId = setInterval(getUser, 120000);
}, null, true, 'Europe/Tallinn');

/* * * * * * * *
 * WC WEBHOOKS *
 * * * * * * * */

// When WooCommerce order is updated webhook
app.post('/api/wc-order-paid', (req, res) => {
  async function saveOrderToErply (session_key, customer_id, line_items, order_total, shipping_method) {
    const order_shipping_method = shipping_method;
    const saveSalesDocumentParams = new URLSearchParams();
    saveSalesDocumentParams.append('clientCode', process.env.ERPLY_CC);
    saveSalesDocumentParams.append('sessionKey', session_key);
    saveSalesDocumentParams.append('request', 'saveSalesDocument');
    saveSalesDocumentParams.append('customerID', customer_id);
    saveSalesDocumentParams.append('type', 'INVWAYBILL');
    saveSalesDocumentParams.append('euInvoiceType', 'DOMESTIC');
    saveSalesDocumentParams.append('paymentType', 'TRANSFER');
    saveSalesDocumentParams.append('paymentTypeID', 6);
    saveSalesDocumentParams.append('paymentStatus', 'PAID');
    saveSalesDocumentParams.append('currencyCode', 'EUR');
    saveSalesDocumentParams.append('sendContentType', 1);
    for (let i = 0; i < line_items.length; i++) {
      saveSalesDocumentParams.append(`productID${i + 1}`, line_items[i].productID);
      saveSalesDocumentParams.append(`amount${i + 1}`, line_items[i].amount);
    }
    if (order_total < 50) {
      const erplyShippingIDs = [
        { method_id: 'parcelmachine_omniva', erply_id : 827 }, 
        { method_id: 'parcelmachine_smartpost', erply_id : 828 },
        { method_id: 'parcelmachine_dpd', erply_id : 830 },
        { method_id: 'local_pickup', erply_id: 982 },
      ];
      let shipping_method_id;
      for (let i = 0; i < erplyShippingIDs.length; i++) {
        if (order_shipping_method === erplyShippingIDs[i].method_id) {
          shipping_method_id = erplyShippingIDs[i].erply_id;
        }
      }
      saveSalesDocumentParams.append(`productID${line_items.length + 1}`, shipping_method_id);
      saveSalesDocumentParams.append(`amount${line_items.length + 1}`, 1);
    } else {
      saveSalesDocumentParams.append(`productID${line_items.length + 1}`, 829);
      saveSalesDocumentParams.append(`amount${line_items.length + 1}`, 1);
    }
    let response = await fetch(ERPLY_URL, { method: 'POST', body: saveSalesDocumentParams });
    let data = response.json();
    return data;
  }
  if (req.body.status === 'processing') {
    // Respond to accept webhook
    res.status(200).send('OK');
    console.log('New Order @ Pauliina e-pood webhook received');
    const wcOrderData = req.body;
    const customerEmail = req.body.billing.email.toLowerCase();
    const customerFirstName = req.body.billing.first_name.trim();
    const customerLastName = req.body.billing.last_name.trim();
    const orderTotal = parseFloat(wcOrderData.total) - (parseFloat(wcOrderData.shipping_total) + parseFloat(wcOrderData.shipping_tax));
    const shippingMethod = wcOrderData.shipping_lines[0].method_id;
    const lineitemsFromWCOrder = wcOrderData.line_items;
    let orderLineitems = [];    
    sendOrderToErply(
      customerEmail, 
      customerFirstName, 
      customerLastName, 
      orderTotal, 
      shippingMethod,
      lineitemsFromWCOrder, 
      orderLineitems
      );
  } 
});

app.listen(process.env.PORT || PORT, () => {
  console.log(`Server running on port ${process.env.PORT || PORT}`)
});

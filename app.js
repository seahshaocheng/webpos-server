require('dotenv').config();
const express = require('express');
var bodyParser = require('body-parser');
const moment = require('moment'); 
const { Client,Config,TerminalLocalAPI, TerminalCloudAPI,} = require('@adyen/api-library');
const { TerminalApiRequest } = require('@adyen/api-library/lib/src/typings/terminal/models');
const QRCode = require('qrcode');
const sgMail = require('@sendgrid/mail')

const app = express();

app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
    res.header('Access-Control-Expose-Headers', 'Content-Length');
    res.header('Access-Control-Allow-Headers', 'Accept, Authorization, Content-Type, X-Requested-With, Range');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    } else {
        return next();
    }
});

app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
    extended: true
})); 

app.get('/',(req,res)=>{
    res.send("Merchant Server is now live");
});

app.post('/makePayment', async (req,res)=>{
    const config = new Config();

    config.apiKey = process.env.APIKEY;
    config.merchantAccount = process.env.MERCHANT_ACCOUNT;

    const client = new Client({ config });
    client.setEnvironment("TEST");

    const terminalAPI = new TerminalCloudAPI(client);
    let terminalAPIPaymentRequest= {
        SaleToPOIRequest:{
            MessageHeader:{
                ProtocolVersion:"3.0",
                MessageClass:"Service",
                MessageCategory:"Payment",
                MessageType:"Request",
                SaleID:"POS-"+moment.utc().format("YYYYMMDDhhmmss"),
                ServiceID:moment.utc().format("YYYYMMDDss"),
                POIID:req.body.terminalId
                //POIID:"S1F2-000158212621442"
            },
            PaymentRequest:{
                SaleData:{
                    SaleTransactionID:{
                        TransactionID:"Mark-POS-"+moment.utc().format("YYYYMMDDhhmmss"),
                        TimeStamp:moment().toISOString()
                    }
                },
                PaymentTransaction:{
                    AmountsReq:{
                        Currency:req.body.currency,
                        RequestedAmount:req.body.amount
                    }
                }
            }
        }
    }

    try{
        const terminalApiResponse = await terminalAPI.sync(terminalAPIPaymentRequest);
        res.send(terminalApiResponse);
    }
    catch(error){
        console.log(error);
    }

});

// email receipt endpoint
app.post('/emailReceipt',async(req,res)=>{

    let orderData = JSON.stringify(req.body.orderData);
    
    try{
        let base64code = await QRCode.toDataURL(orderData);
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);
        let qrData = base64code.split(",");

        const emailData = {
            from: {
                email: 'markdev.seah@gmail.com',
                name: 'Adyen SG WebPOS'
            },
            personalizations:[
                {
                    to:[
                        {
                            email:req.body.customerEmail
                        }
                    ],
                    dynamic_template_data:{
                        items:req.body.orderData.items,
                        receipt:true,
                        orderqr:"<img alt='Order QR' src='"+base64code+"' width='100' height='100'/>"
                    }
                }
            ],
            subject: 'Your Example Order Confirmation',
            template_id:"d-f939187424b04cd7abd1dfca87cba8ba",
            attachments:[
                {
                    filename:"testqrcode.png",
                    content:qrData[1],
                    content_id:"orderqrcode"
                }
            ]
        }

          sgMail
            .send(emailData)
            .then(() => {
              console.log('Email sent');
              res.send({msg:"Receipt successfully sent"});
            })
            .catch((error) => {
              console.error(JSON.stringify(error))
              res.status(500).send({msg:"Something went wrong went sending receipt to customer email"});
            });
    }
    catch(error){
        console.log(error);
        res.status(500).send({msg:"Something went wrong went sending receipt to customer email"});
    }
});

//Reversal endpoint


// Card Acquisition endpoint



app.listen(process.env.PORT || 3000, () => {
    console.log("Merchant Server is live");
  }
);
require('dotenv').config();
const express = require('express');
var bodyParser = require('body-parser');
const moment = require('moment'); 
const { Client,Config,TerminalLocalAPI, TerminalCloudAPI,} = require('@adyen/api-library');
const { TerminalApiRequest } = require('@adyen/api-library/lib/src/typings/terminal/models');

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
    //config.apiKey = "AQEyhmfxLYLGbxVLw0m/n3Q5qf3VeIpUAJZETHZ7x3yuu2dYh/gaN2nwzL5TukZH2pDJEmUQwV1bDb7kfNy1WIxIIkxgBw==-34beH5jK8XJ9ptLk3/JmO3dRbGIrjVOMJTi7AHqLiJM=-&M$(QQPGr3,jve&6"
    //config.merchantAccount = "PME_POS_SG";

    config.apiKey = process.env.APIKEY;
    config.merchantAccount = process.env.MERCHANT_ACCOUNT;

    //"URL of the terminal, for example https://192.168.68.117, WITHOUT the port/nexo part :8443/nexo/";
    console.log("hit");
    console.log(req.body);
    const client = new Client({ config });
    client.setEnvironment("TEST");

    const terminalLocalAPI = new TerminalCloudAPI(client);
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
        const terminalApiResponse = await terminalLocalAPI.sync(terminalAPIPaymentRequest);
        res.send(terminalApiResponse);
    }
    catch(error){
        console.log(error);
    }

});

app.listen("4000", () => {
    console.log("Merchant Server is live");
  }
);
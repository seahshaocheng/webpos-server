require('dotenv').config();
const express = require('express');
var bodyParser = require('body-parser');
const moment = require('moment'); 
const { Client,Config,TerminalLocalAPI, TerminalCloudAPI,} = require('@adyen/api-library');
const { TerminalApiRequest } = require('@adyen/api-library/lib/src/typings/terminal/models');
const QRCode = require('qrcode');
const sgMail = require('@sendgrid/mail');
const axios = require('axios');
const { terminal } = require('@adyen/api-library/lib/src/typings');
const {makeTerminalRequest} = require('./utilities/terminalInterface');

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
    let paymentData = {
        currency:req.body.currency,
        amount:req.body.amount
    }
    let paymentRequest = makeTerminalRequest("Payment",req.body.terminalId,req.body.posId,paymentData);

    try{
        const terminalApiResponse = await terminalAPI.sync(paymentRequest);
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
app.post('/cardacq',async(req,res)=>{
    const config = new Config();

    config.apiKey = process.env.APIKEY;
    config.merchantAccount = process.env.MERCHANT_ACCOUNT;

    const client = new Client({ config });
    client.setEnvironment("TEST");

    const terminalAPI = new TerminalCloudAPI(client);
    let cardAcqusitionData = {
        amount :req.body.amount
    }
    let cardAcquisitionRequest = makeTerminalRequest("CardAcquisition",req.body.terminalId,req.body.posId,cardAcqusitionData);

    try{
        const terminalApiResponse = await terminalAPI.sync(cardAcquisitionRequest);
        //res.send(terminalApiResponse);
        //process some input and send custom input

        //process cardAcqData
        if(terminalApiResponse!=={}){
            if(terminalApiResponse.SaleToPOIResponse.CardAcquisitionResponse.Response.Result==="Success"){
                //Takecard token and pass to Joffery'sAPI
                //console.log(JSON.stringify(terminalApiResponse,null,4))
                
                let cardAcqRef = terminalApiResponse.SaleToPOIResponse.CardAcquisitionResponse.POIData.POITransactionID.TransactionID;
                
                //Make Input Call
                let InputRequest = makeTerminalRequest("Input",req.body.terminalId);
                //console.log(JSON.stringify(InputRequest,null,4))
                const inputTerminalApiResponse = await terminalAPI.sync(InputRequest);
                
                //res.send(inputTerminalApiResponse);
                //process Input response
                if(inputTerminalApiResponse.SaleToPOIResponse.InputResponse.InputResult.Response.Result==="Success"){
                    //Make Payment with discounted amount based on points
                    let paymentData = {
                        currency:"SGD",
                        amount:50
                    }

                    let paymentRequest = makeTerminalRequest("Payment",req.body.terminalId,paymentData)
                    console.log(JSON.stringify(paymentRequest,null,4));
                    paymentRequest['SaleToPOIRequest']['PaymentRequest']['PaymentData']={
                        CardAcquisitionReference:{
                            TimeStamp:moment().toISOString(),
                            TransactionID:cardAcqRef
                        }
                    }
                    const paymentApiResponse = await terminalAPI.sync(paymentRequest);
                    res.send(paymentApiResponse);
                }
                else{
                    res.send({"message":"Unsuccessful Input Request"});
                }
            }
            else{
                res.send({"message":"Unsuccessful Card Acquisition"});
            }
        }
    }
    catch(error){
        console.log(error);
        res.send(error);
    }
});

app.post('/inputRequest',async(req,res)=>{
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
                MessageClass:"Device",
                MessageCategory:"Input",
                MessageType:"Request",
                SaleID:"POS-"+moment.utc().format("YYYYMMDDhhmmss"),
                ServiceID:moment.utc().format("YYYYMMDDss"),
                POIID:req.body.terminalId
            },
            InputRequest:inputRequest
        }
    }

    try{
        console.log(terminalAPIPaymentRequest);
        const terminalApiResponse = await terminalAPI.sync(terminalAPIPaymentRequest);
        res.send(terminalApiResponse);
        //process some input and send custom input
    }
    catch(error){
        console.log(error);
    }
});

app.post('/fetchStores',async(req,res)=>{
    try{
        let fetchStores = await axios({
            method:'POST',
            headers:{
                'x-api-key': process.env.APIKEY
            },
            url:'https://postfmapi-test.adyen.com/postfmapi/terminal/v1/getStoresUnderAccount',
            data:{
                companyAccount:process.env.COMPANY_ACCOUNT,
                merchantAccount:process.env.MERCHANT_ACCOUNT
            }
        });

        let availableStores = [];

        fetchStores.data.stores.map((store,i)=>{
            availableStores.push(store.store);
        });

        res.send(availableStores);
    }
    catch(e){
        res.status(500).send(e);
    }
});

//find terminal endpoint
app.post('/fetchTerminals',async(req,res)=>{
    const config = new Config();

    config.apiKey = process.env.APIKEY;
    config.merchantAccount = process.env.MERCHANT_ACCOUNT;
    let requestData={
        companyAccount:process.env.COMPANY_ACCOUNT,
        merchantAccount:process.env.MERCHANT_ACCOUNT
    }

    console.log("store is not undefied", req.body);
    if(req.body.store!==undefined){
        requestData['store']=req.body.store
    }

    console.log("the store",requestData);

    try{
        let fetchTerminalsResponse = await axios({
            method:'POST',
            headers:{
                'x-api-key': process.env.APIKEY
            },
            url:'https://postfmapi-test.adyen.com/postfmapi/terminal/v1/getTerminalsUnderAccount',
            data:requestData
        });

    
        let availableTerminals = [];

        if(fetchTerminalsResponse.data.merchantAccounts!==undefined && fetchTerminalsResponse.data.merchantAccounts.length>0){
            let inStoreTerminals = fetchTerminalsResponse.data.merchantAccounts[0].inStoreTerminals;
            let storesTerminals = fetchTerminalsResponse.data.merchantAccounts[0].stores;
                console.log(inStoreTerminals);
            if(inStoreTerminals!==undefined && inStoreTerminals.length>0){
                inStoreTerminals.map((terminal,i)=>{
                    let terminalData = {
                        POIID:terminal,
                        store:"MerchantAccountLevel",
                    }
                    console.log(terminalData);
                    availableTerminals.push(terminalData);
                });
            }
            
            if(storesTerminals!==undefined && storesTerminals.length>0){
                storesTerminals.map((store,i)=>{
                    if(store.inStoreTerminals.length>0){
                        store.inStoreTerminals.map((terminal,i)=>{
                            let terminalData = {
                                POIID:terminal,
                                store:store.store,
                            }
                            availableTerminals.push(terminalData);
                        });
                    }
                });
            }
        }
        res.send(availableTerminals);
    }
    catch(e){
        res.status(500).send(e);
    }
});


app.listen(process.env.PORT || 3000, () => {
    console.log("Merchant Server is live");
  }
);
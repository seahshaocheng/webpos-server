require('dotenv').config();
const express = require('express');
var bodyParser = require('body-parser');
const moment = require('moment'); 
const { Client,Config,TerminalLocalAPI, TerminalCloudAPI,} = require('@adyen/api-library');
const { TerminalApiRequest } = require('@adyen/api-library/lib/src/typings/terminal/models');
const {queryMockProfile,updateMockProfile} = require('./data/mockPointsProfile');
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
    let paymentRequestData = {
        currency:req.body.currency,
        amount:req.body.amount
    }
    let paymentRequest1 = makeTerminalRequest("Payment",req.body.terminalId,req.body.posId,paymentRequestData);

    try{
        const terminalApiResponse = await terminalAPI.sync(paymentRequest1);
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
    console.log(JSON.stringify(cardAcquisitionRequest,null,4))
    try{
        const terminalApiResponse = await terminalAPI.sync(cardAcquisitionRequest);
        //get cardAlias
        let useMock = true;

        if(req.body.useMock!==undefined){
            useMock = req.body.useMock;
        }

        if(terminalApiResponse!=={}){
            console.log(JSON.stringify(terminalApiResponse,null,4));
            if(terminalApiResponse.SaleToPOIResponse.CardAcquisitionResponse.Response.Result==="Success"){

                let cardData = null;
                if(terminalApiResponse.SaleToPOIResponse.CardAcquisitionResponse.PaymentInstrumentData.CardData.PaymentToken!==undefined){
                    cardData=terminalApiResponse.SaleToPOIResponse.CardAcquisitionResponse.PaymentInstrumentData.CardData.PaymentToken.TokenValue;
                    console.log(cardData);
                }

                let cardAcqRef = terminalApiResponse.SaleToPOIResponse.CardAcquisitionResponse.POIData.POITransactionID.TransactionID;
                //TODO: Take card token and pass to Joffery API for check.
                //console.log(JSON.stringify(terminalApiResponse,null,4))
                let fetchLoyaltyAccount = null;

                if(useMock){
                    fetchLoyaltyAccount = queryMockProfile(cardData);
                }
                else{
                    fetchLoyaltyAccount = await axios({
                        method:'POST',
                        url:'https://swiss-army-kinfe-challenge.herokuapp.com/getPointsBalance/',
                        data:{
                            cardAlias:"card001"
                        }
                    });
                }
                
                let selectedIndex = -1; 
                let selectedAccount = null;
                let discountedAmount = req.body.amount;
                if(fetchLoyaltyAccount!==null && fetchLoyaltyAccount.data!==undefined && fetchLoyaltyAccount.data.length > 1){
                    let otherData= {accounts:fetchLoyaltyAccount.data};
                    //Make Input Call for more than 1 account
                    let InputRequest = makeTerminalRequest("Input",req.body.terminalId,req.body.posId,otherData);
                    //console.log(JSON.stringify(InputRequest,null,4))
                    const inputTerminalApiResponse = await terminalAPI.sync(InputRequest);
                    console.log(JSON.stringify(inputTerminalApiResponse,null,4));
                    //process Input response
                    if(inputTerminalApiResponse.SaleToPOIResponse.InputResponse.InputResult.Response.Result==="Success"){
                        inputTerminalApiResponse.SaleToPOIResponse.InputResponse.InputResult.Input.MenuEntryNumber.map((menu,i)=>{
                            if(menu){
                                selectedIndex=i;
                                selectedAccount=fetchLoyaltyAccount.data[i];
                                return;
                            }
                        });
                    }
                }

                if(fetchLoyaltyAccount.data!==undefined && fetchLoyaltyAccount.data.length === 1){
                    selectedIndex=0;
                    selectedAccount=fetchLoyaltyAccount.data[0];
                }
                //Complete phone number verification

                //Ask for redeem consent
                let consent = false;
                if(selectedAccount!==null){
                    let consentRequest = makeTerminalRequest("ConsentInput",req.body.terminalId,req.body.posId,selectedAccount);
                    //console.log(JSON.stringify(InputRequest,null,4))
                    const consentInputResponse = await terminalAPI.sync(consentRequest);
                    if(consentInputResponse.SaleToPOIResponse.InputResponse.InputResult.Response.Result==="Success"){
                        if(consentInputResponse.SaleToPOIResponse.InputResponse.InputResult.Input.MenuEntryNumber[0]){
                            consent = true;
                        }
                    }
                 }  

                 if(consent){
                    let discount= 20 ;
                    discountedAmount -= discount;
                 }
                
                //Make Payment with discounted amount based on points
                let paymentData = {
                    currency:req.body.currency,
                    amount:discountedAmount
                }

                let paymentRequest = makeTerminalRequest("Payment",req.body.terminalId,req.body.posId,paymentData)
                paymentRequest['SaleToPOIRequest']['PaymentRequest']['PaymentData']={
                    CardAcquisitionReference:{
                        TimeStamp:moment().toISOString(),
                        TransactionID:cardAcqRef
                    }
                }
                const paymentApiResponse = await terminalAPI.sync(paymentRequest);
                //update the points
                if(selectedAccount!==null && consent!==false){
                    if(paymentApiResponse.SaleToPOIResponse!==undefined){
                        if(paymentApiResponse.SaleToPOIResponse.PaymentResponse.Response.Result!==undefined){
                            if(paymentApiResponse.SaleToPOIResponse.PaymentResponse.Response.Result==="Success"){
                                if(useMock){
                                    updateMockProfile(cardData,selectedIndex,selectedAccount.pointbalance-20);
                                }
                                else{
                                    await axios({
                                        method:'POST',
                                        url:'https://swiss-army-kinfe-challenge.herokuapp.com/updatePointsBalance/',
                                        data:{
                                            points:-20,
                                            cardAlias:cardData,
                                            phoneNumber:selectedAccount.phoneNumber
                                        }
                                    });
                                }
                            }
                        }
                    }
                }
                
                res.send(paymentApiResponse);
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
    console.log({
        companyAccount:process.env.COMPANY_ACCOUNT,
        merchantAccount:process.env.MERCHANT_ACCOUNT
    });
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
    console.log("Merchant Server is live at "+process.env.PORT);
  }
);
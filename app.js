require('dotenv').config();
const express = require('express');
var bodyParser = require('body-parser');
const moment = require('moment'); 
const { Client,Config,TerminalLocalAPI, TerminalCloudAPI,CheckoutAPI} = require('@adyen/api-library');
const { TerminalApiRequest } = require('@adyen/api-library/lib/src/typings/terminal/models');
const {queryMockProfile,updateMockProfile,insertProfile} = require('./data/mockPointsProfile');
const QRCode = require('qrcode');
const sgMail = require('@sendgrid/mail');
const axios = require('axios');
const { terminal } = require('@adyen/api-library/lib/src/typings');
const {makeTerminalRequest} = require('./utilities/terminalInterface');
const cron = require('node-cron');

let pendingOrders = [];

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
        amount:req.body.amount,
        transaction_id: "Mark-POS-"+moment.utc().format("YYYYMMDDss")
    }

    let OrderDetails = {
        reference:paymentRequestData.transaction_id,
        email:req.body.shopperEmail
    }

    pendingOrders.push(OrderDetails);
    let paymentRequest1 = makeTerminalRequest("Payment",req.body.terminalId,req.body.posId,paymentRequestData);

    try{
        console.log("sending payment request");
        console.log(paymentRequest1);
        const terminalApiResponse = await terminalAPI.sync(paymentRequest1);
        console.log(terminalApiResponse);
        res.send(terminalApiResponse);
    }
    catch(error){
        console.log(error);
    }

});

const initaliseClient = (adyenENV,region) =>{
    const config = new Config();
    if(adyenENV==="LIVE"){
        config.apiKey = process.env.APIKEY_LIVE;
        config.merchantAccount = process.env.MERCHANT_ACCOUNT;
        switch(region){
            case "APSE":
                config.checkoutEndpoint = process.env.APSEAPIURL;
            break;
            case "US":
                config.checkoutEndpoint = process.env.USAPIURL;
            break;
            case "AU":
                config.checkoutEndpoint = process.env.USAPIURL;
            break;
            default:
                console.log("Chooing default endpoint");
                config.checkoutEndpoint = process.env.DEFAULTREGIONAPIURL;
        }
    }
    else{
        config.apiKey = process.env.APIKEY;
        config.merchantAccount = process.env.MERCHANT_ACCOUNT;
    }

    console.log(config.merchantAccount);
    const client = new Client({ config });
    if(adyenENV === "TEST"){
        client.setEnvironment("TEST");
    }

    const checkout = new CheckoutAPI(client);
    return checkout;
}

//sessions
app.post("/sessions",async(req, res)=> {
    const RequestBody = req.body;
    let adyenENV ="TEST";
    let region = "TEST";
    let checkout = initaliseClient(adyenENV,region);
    RequestBody.merchantAccount = process.env.MERCHANT_ACCOUNT;
    RequestBody.reference = "Mark_ECOMDEMODEFAULT_"+moment.utc().format("YYYYMMDDhhmmss");
    let OrderDetails = {
        reference:RequestBody.reference,
        email:RequestBody.shopperEmail
    }
    pendingOrders.push(OrderDetails);
    delete RequestBody.shopperEmail;
    console.log(RequestBody);
    try{
        let checkoutSessionResponse = await checkout.sessions(RequestBody);
        console.log("session data");
        console.log([checkoutSessionResponse,RequestBody.reference]);
        res.json([checkoutSessionResponse,RequestBody.reference]);
    }
    catch(error){
        console.log(error);
        res.status(500).send({
            error
        })
    }
});

app.post("/notifications",async (req,res)=>{
    let orderData = req.body;
    console.log("receiving webhook");
    console.log(JSON.stringify(orderData, null, 4));
    try{
        let base64code = await QRCode.toDataURL(orderData.notificationItems[0].NotificationRequestItem.pspReference);
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);
        let qrData = base64code.split(",");

        let sendEmail = false;
        let email = null;
        let template_id= "d-f939187424b04cd7abd1dfca87cba8ba";
        let dynamic_template_data = null;

        switch(orderData.notificationItems[0].NotificationRequestItem.eventCode){
            case "AUTHORISATION":
                sendEmail=true;
                let order = pendingOrders.find(x => x.reference === orderData.notificationItems[0].NotificationRequestItem.merchantReference);
                if(order!==undefined){
                    email = order.email;
                    order.pspReference = orderData.notificationItems[0].NotificationRequestItem.pspReference;
                    order.amount = orderData.notificationItems[0].NotificationRequestItem.amount.currency+" "+(Number(orderData.notificationItems[0].NotificationRequestItem.amount.value)/100);
                    dynamic_template_data={
                        order_number:orderData.notificationItems[0].NotificationRequestItem.merchantReference,
                        pspReference:orderData.notificationItems[0].NotificationRequestItem.pspReference,
                        amount:orderData.notificationItems[0].NotificationRequestItem.amount.currency+" "+(Number(orderData.notificationItems[0].NotificationRequestItem.amount.value)/100),
                        receipt:true,
                        orderqr:"<img alt='Order QR' src='"+base64code+"' width='100' height='100'/>"
                    }
                }
                break;
            case "REFUND":
                sendEmail=true;
                let originalorder = pendingOrders.find(x => x.pspReference === orderData.notificationItems[0].NotificationRequestItem.originalReference);
                if(originalorder!==undefined){
                    email = originalorder.email;
                }
                template_id= "d-a2732940b7b34a6e885a56e384199e33"
                break;
            case "CANCEL_OR_REFUND":
                sendEmail=true;
                let originalorder1 = pendingOrders.find(x => x.pspReference === orderData.notificationItems[0].NotificationRequestItem.originalReference);
                if(originalorder1!==undefined){
                    email = originalorder1.email;
                }
                template_id= "d-a2732940b7b34a6e885a56e384199e33"
                break;
        }
        console.log("Sending email to "+email);
        if(sendEmail && email !==null){
            const emailData = {
                from: {
                    email:"demo@markseah.com",
                    name: 'Adyen SG IM Demo'
                },
                personalizations:[
                    {
                        to:[
                            {
                                email
                            }
                        ],
                        dynamic_template_data
                    }
                ],
                subject: 'Your Example Order Confirmation',
                template_id,
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
                })
                .catch((error) => {
                  console.error(JSON.stringify(error));
                  console.log("Something went wrong went sending receipt to customer email"); 
                });
        }
        res.send("[accepted]");
    }
    catch(error){
        console.log(error); 
        console.log("Something went wrong went sending receipt to customer email"); 
        res.send("[accepted]");
    }
});

// email receipt endpoint
app.post('/emailReceipt',async(req,res)=>{
    //console.log(pendingOrders.find(x => x.reference === req.body.reference));
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    let originalOrder = pendingOrders.find(x => x.pspReference === req.body.pspReference)
    let dynamic_template_data={
        order_number:originalOrder.reference,
        pspReference:originalOrder.pspReference,
        amount:originalOrder.amount,
        receipt:true,
    }

    let  email = originalOrder.email;

    //res.status(200).send(pendingOrders);
    const emailData = {
        from: {
            email:"demo@markseah.com",
            name: 'Adyen SG IM Demo'
        },
        personalizations:[
            {
                to:[
                    {
                        email
                    }
                ],
                dynamic_template_data
            }
        ],
        subject: 'Refund Successful',
        template_id:"d-a2732940b7b34a6e885a56e384199e33"
    }
      sgMail
        .send(emailData)
        .then(() => {
            res.sendStatus(200);
            console.log('Email sent');
        })
        .catch((error) => {
            res.sendStatus(500);
            console.error(JSON.stringify(error));
            console.log("Something went wrong went sending receipt to customer email"); 
        });
});

app.post('/emailSelfie',async(req,res)=>{
    //console.log(pendingOrders.find(x => x.reference === req.body.reference));
    let customerEmail = req.body.customerEmail;
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    let dynamic_template_data={
        name:req.body.name,
        title:req.body.title,
        email:req.body.contactEmail,
        contact:req.body.contact,
        photo:"<img alt='Selfie' src='"+req.body.photo+"' width='350'/>",
        receipt:true,
    }

    let  ccEmail = req.body.contactEmail;
    let photoData = req.body.photo.split(",");
    const emailData = {
        from: {
            email:"demo@markseah.com",
            name: 'Adyen SG IM Demo'
        },
        personalizations:[
            {
                to:[
                    {
                        email:customerEmail
                    }
                ],
                cc: [
                    {
                        email:ccEmail
                    }
                ],
                dynamic_template_data
            },
            
        ],
        subject: 'Thank you, here\'s the selfie',
        template_id:"d-57e6d887ad5943ccb618838efb6a2b10",
        attachments:[
            {
                filename:"demoselfie.png",
                content:photoData[1],
                content_id:"orderqrcode"
            }
        ]
    }
    console.log(JSON.stringify(emailData,0,4));
      sgMail
        .send(emailData)
        .then(() => {
            console.log('Email sent');
            res.sendStatus(200);
        })
        .catch((error) => {
            console.error(JSON.stringify(error));
            console.log("Something went wrong went sending receipt to customer email"); 
            res.sendStatus(500);
        });
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
        transaction_id:"Mark-POS-"+moment.utc().format("YYYYMMDDss"),
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
        console.log("trying...");
        console.log(JSON.stringify(terminalApiResponse,null,4));

        if(terminalApiResponse!=={}){
            if(terminalApiResponse.SaleToPOIResponse.CardAcquisitionResponse.Response.Result==="Success"){

                let cardData = null;
                if(terminalApiResponse.SaleToPOIResponse.CardAcquisitionResponse.PaymentInstrumentData.CardData.PaymentToken!==undefined){
                    cardData=terminalApiResponse.SaleToPOIResponse.CardAcquisitionResponse.PaymentInstrumentData.CardData.PaymentToken.TokenValue;
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
                let register = false;
                
                if(fetchLoyaltyAccount!==null && fetchLoyaltyAccount.data!==undefined && fetchLoyaltyAccount.data.length > 1){
                    let otherData= {accounts:fetchLoyaltyAccount.data};
                    //Make Input Call for more than 1 account
                    let InputRequest = makeTerminalRequest("Input",req.body.terminalId,req.body.posId,otherData);
                    //console.log(JSON.stringify(InputRequest,null,4))
                    const inputTerminalApiResponse = await terminalAPI.sync(InputRequest);
                    //process Input response
                    if(inputTerminalApiResponse.SaleToPOIResponse.InputResponse.InputResult.Response.Result==="Success"){
                        inputTerminalApiResponse.SaleToPOIResponse.InputResponse.InputResult.Input.MenuEntryNumber.map((menu,i)=>{
                            if(menu){
                                selectedIndex=i;
                                selectedAccount=fetchLoyaltyAccount.data[i];
                                if(selectedAccount===undefined){
                                    console.log("seleccted no");
                                    selectedAccount = null;
                                    register = true;
                                }
                                return;
                            }
                        });
                    }
                }

                if(fetchLoyaltyAccount === null){
                    let registerConsentRequest = makeTerminalRequest("RegisterConsentInput",req.body.terminalId,req.body.posId,selectedAccount);
                    //console.log(JSON.stringify(InputRequest,null,4))
                    const registerConsentResponse = await terminalAPI.sync(registerConsentRequest);
                    if(registerConsentResponse.SaleToPOIResponse.InputResponse.InputResult.Response.Result==="Success"){
                        if(registerConsentResponse.SaleToPOIResponse.InputResponse.InputResult.Input.MenuEntryNumber[0]){
                            register = true;
                        }
                    }
                }

                if(fetchLoyaltyAccount!==null && fetchLoyaltyAccount.data.length === 1){
                    selectedIndex=0;
                    selectedAccount=fetchLoyaltyAccount.data[0];
                }
                //Complete phone number verification
                if(selectedAccount===null && register){
                    let registerAccountRequest = makeTerminalRequest("RegisterAccount",req.body.terminalId,req.body.posId,selectedAccount);
                    console.log(JSON.stringify(registerAccountRequest,null,4));
                    const registerAccountResponse = await terminalAPI.sync(registerAccountRequest);
                    console.log(JSON.stringify(registerAccountResponse,null,4));
                    if(registerAccountResponse.SaleToPOIResponse.InputResponse.InputResult.Response.Result==="Success"){
                        if(registerAccountResponse.SaleToPOIResponse.InputResponse.InputResult.Input.TextInput.length>0){
                            let profilename = registerAccountResponse.SaleToPOIResponse.InputResponse.InputResult.Input.TextInput;
                            if(useMock){
                                insertProfile(cardData,profilename,req.body.amount);
                            }
                        }
                    }
                }

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
        console.log(availableStores);
        res.send(availableStores);
    }
    catch(e){
        console.log(e);
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
    cron.schedule('*/25 * * * *', () => {
        console.log( "Keeping Merchant Server is alive at "+process.env.PORT);
        axios.get('https://webpos-server.herokuapp.com/');
      })
  }
);
const {makePaymentRequest} = require('../data/paymentRequest');
const {makeCardAcquisitionRequest} = require('../data/cardAcquisitionRequest');
const {inputRequest} = require('../data/inputRequest');
const moment = require('moment'); 

const makeTerminalRequest = (MessageCategory,terminalId,posId,otherData) => {
    let ISOTimenow = moment().toISOString();
    let request = {
        SaleToPOIRequest:{
            MessageHeader:{
                ProtocolVersion:"3.0",
                MessageClass:null,
                MessageCategory:null,
                MessageType:"Request",
                SaleID:posId+"-"+moment.utc().format("YYYYMMDDhhmmss"),
                ServiceID:moment.utc().format("YYYYMMDDss"),
                POIID:terminalId
            }
        }
    }
    let transaction_id = "Mark-POS-"+moment.utc().format("YYYYMMDDss");
    switch(MessageCategory){
        case "Payment":
            request.SaleToPOIRequest.MessageHeader.MessageCategory=MessageCategory;
            request.SaleToPOIRequest.MessageHeader.MessageClass="Service";
            request.SaleToPOIRequest['PaymentRequest'] = makePaymentRequest(ISOTimenow,transaction_id,otherData['currency'],otherData['amount']);
        break;
        case "Reversal":
        break;
        case "CardAcquisition":
            request.SaleToPOIRequest.MessageHeader.MessageCategory=MessageCategory;
            request.SaleToPOIRequest.MessageHeader.MessageClass="Service";
            request.SaleToPOIRequest['CardAcquisitionRequest'] = makeCardAcquisitionRequest(ISOTimenow,transaction_id,otherData['amount']);
        break;
        case "Input":
            request.SaleToPOIRequest.MessageHeader.MessageCategory=MessageCategory;
            request.SaleToPOIRequest.MessageHeader.MessageClass="Device";
            request.SaleToPOIRequest['InputRequest'] = inputRequest;
        break;
        default:
            return false;
    }
    return request
}

module.exports = {makeTerminalRequest};
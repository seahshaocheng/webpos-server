let paymentRequest = {
    SaleData:{
        SaleTransactionID:{
            TransactionID:null,
            TimeStamp:null
        }
    },
    PaymentTransaction:{
        AmountsReq:{
            Currency:null,
            RequestedAmount:null
        }
    }
}

const makePaymentRequest =  (transactionTime,transactionid,currency, amount) =>  {
    paymentRequest.SaleData.SaleTransactionID.TransactionID=transactionid;
    paymentRequest.SaleData.SaleTransactionID.TimeStamp= transactionTime;
    paymentRequest.PaymentTransaction.AmountsReq.Currency=currency;
    paymentRequest.PaymentTransaction.AmountsReq.RequestedAmount=amount;
    return paymentRequest;
}

module.exports = {makePaymentRequest}
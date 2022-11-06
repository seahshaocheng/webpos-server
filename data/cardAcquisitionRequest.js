let CardAcquisitionRequest = {
    SaleData:{
        SaleTransactionID:{
            TransactionID:null,
            TimeStamp:null
        },
        TokenRequestedType:"Customer"
    },
    CardAcquisitionTransaction:{
        TotalAmount:null
    }
}

const makeCardAcquisitionRequest =  (transactionTime,transactionId,amount) =>  {
    CardAcquisitionRequest.SaleData.SaleTransactionID.TransactionID= transactionId;
    CardAcquisitionRequest.SaleData.SaleTransactionID.TimeStamp= transactionTime;
    CardAcquisitionRequest.CardAcquisitionTransaction.TotalAmount= amount;
    return CardAcquisitionRequest;
}

module.exports = {makeCardAcquisitionRequest}
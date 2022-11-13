let MockProfilePoints = [
    {
        "P632236034034292":[
            {
                "name":"Adam",
                "phonenumber":"0123456987",
                "pointbalance":"400"
            },
            {
                "name":"Adam Second",
                "phonenumber":"0123456788",
                "pointbalance":"260"
            },
        ],
        "F490875278278817":[
            {
                "name":"Mark",
                "phonenumber":"0123456987",
                "pointbalance":"150"
            }
        ]
    }
]

const updateMockProfile = (cardAlias,selectedIndex,points) => {
    if(MockProfilePoints[0][cardAlias]!==undefined){
        MockProfilePoints[0][cardAlias][selectedIndex].pointbalance=points;
    }
    return true
}

const queryMockProfile =  (cardAlias) =>  {
    console.log("finding card alials "+cardAlias)
    return {data:MockProfilePoints[0][cardAlias]}
}

module.exports = {queryMockProfile,updateMockProfile}
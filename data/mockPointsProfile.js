let MockProfilePoints = [
    {
        "P632236034034292":[
            {
                "name":"Jack",
                "phonenumber":"0123456987",
                "pointbalance":"400"
            },
        ],
        "F490875278278817":[
            {
                "name":"Mark",
                "phonenumber":"0123456987",
                "pointbalance":"150"
            }
        ],
        "A594984856773903":[
            {
                "name":"Ben",
                "phonenumber":"87654321",
                "pointbalance":"1560"
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
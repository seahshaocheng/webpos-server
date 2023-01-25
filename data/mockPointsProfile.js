let MockProfilePoints = [
    {
        "M469509594859802":[
            {
                "name":"Jack",
                "phonenumber":"0123456987",
                "pointbalance":"400"
            },
            {
                "name":"Mark",
                "phonenumber":"0123456987",
                "pointbalance":"150"
            }
        ]
    }
]

const insertProfile = (cardAlias,profileName,points) => {
    if(MockProfilePoints[0][cardAlias]!==undefined){
        MockProfilePoints[0][cardAlias].push({
            name:profileName,
            phonenumber:"1231231293801",
            pointbalance:points
        })
    }
    else{
        MockProfilePoints[0][cardAlias] = [];
        MockProfilePoints[0][cardAlias].push({
            name:profileName,
            phonenumber:"1231231293801",
            pointbalance:points
        })
    }
    console.log(MockProfilePoints);
    return true;
}

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

module.exports = {queryMockProfile,updateMockProfile,insertProfile}
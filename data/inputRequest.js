const makeAccountInputRequest =  (accounts) =>  {
    let inputRequest = {
        DisplayOutput:{
            Device:"CustomerDisplay",
            InfoQualify:"Display",
            OutputContent:{
                OutputFormat:"Text",
                PredefinedContent:{
                    ReferenceID:"MenuButtons"
                },
                OutputText:[
                    {
                        "Text":"Hi there, we found more than 1 account"
                    },
                    {
                        "Text":"Choose the account to use"
                    }
                ]
            },
            MenuEntry:[]
        },
        InputData:{
            Device:"CustomerInput",
            InfoQualify:"Input",
            InputCommand:"GetMenuEntry",
            MaxInputTime:120
        }
    }
    
    accounts.map((account,i)=>{
        let menu = {
            OutputFormat:"Text",
            OutputText:[
                {
                    "Text":account.name
                }
            ]
        }
        inputRequest.DisplayOutput.MenuEntry.push(menu);
    })

    return inputRequest;
}

const makeConsentRequest =  (name,points) =>  {
    let inputRequest = {
        DisplayOutput:{
            Device:"CustomerDisplay",
            InfoQualify:"Display",
            OutputContent:{
                OutputFormat:"Text",
                PredefinedContent:{
                    ReferenceID:"MenuButtons"
                },
                OutputText:[
                    {
                        "Text":"Hi "+name+", You have "+points+" points"
                    },
                    {
                        "Text":"Do you want to redeem"
                    }
                ]
            },
            MenuEntry:[{
                OutputFormat:"Text",
                OutputText:[
                    {
                        "Text":"Yes"
                    }
                ]
            },
            {
                OutputFormat:"Text",
                OutputText:[
                    {
                        "Text":"No"
                    }
                ]
            }]
        },
        InputData:{
            Device:"CustomerInput",
            InfoQualify:"Input",
            InputCommand:"GetMenuEntry",
            MaxInputTime:120
        }
    }
    return inputRequest;
}



module.exports={makeAccountInputRequest,makeConsentRequest};
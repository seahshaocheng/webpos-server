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
                    },
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
    });

    inputRequest.DisplayOutput.MenuEntry.push(
        {
            OutputFormat:"Text",
            OutputText:[
                {
                    "Text":"Register a new Account"
                }
            ]
        }
    )

    return inputRequest;
}

const RegisterAccount =  () =>  {
    let inputRequest = {
        DisplayOutput:{
            Device:"CustomerDisplay",
            InfoQualify:"Display",
            OutputContent:{
                OutputFormat:"Text",
                PredefinedContent:{
                    ReferenceID:"GetText"
                },
                OutputText:[
                    {
                        "Text":"Your name:"
                    }
                ]
            }
        },
        InputData:{
            Device:"CustomerInput",
            InfoQualify:"Input",
            InputCommand:"TextString",
            MaxInputTime:120,
        }
    }
    return inputRequest;
}

const makeRegisterConsent =  () =>  {
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
                        "Text":"Do you want to register?"
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
                        "Text":"Do you want to redeem 20 points?"
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



module.exports={makeAccountInputRequest,makeConsentRequest,RegisterAccount,makeRegisterConsent};
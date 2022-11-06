const inputRequest ={
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
                    "Text":"Multiple Accounts found"
                },
                {
                    "Text":"Please tap one of the options below to credit points"
                }
            ]
        },
        MenuEntry:[
            {
                OutputFormat:"Text",
                OutputText:[
                    {
                        "Text":"Account A"
                    }
                ]
            },
            {
                OutputFormat:"Text",
                OutputText:[
                    {
                        "Text":"Account B"
                    }
                ]
            },
        ]
    },
    InputData:{
        Device:"CustomerInput",
        InfoQualify:"Input",
        InputCommand:"GetMenuEntry",
        MaxInputTime:120
    }
}

exports.inputRequest=inputRequest;
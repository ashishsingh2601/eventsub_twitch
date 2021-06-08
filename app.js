const express = require('express');
const request = require('request');
const queryString = require('querystring');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const ngrok = require('ngrok');
var jsonParser = bodyParser.json();

dotenv.config();

//server setup
const app = express();
var callbackURL;
ngrok.connect().then((data)=>{
    console.log(data);
    // callbackURL = 'https://ec2-54-166-78-39.compute-1.amazonaws.com:443/';
    callbackURL = data;
});






const clientID = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
// const callbackURL = (async function() {
//         await ngrok.connect(3000);
//         Promise.resolve("URL received!"); 
// })().then((msg)=>{
//     console.log(msg);
//     console.log(callbackURL);
// });


// const callbackURL = await ngrok.connect(3000).then(url=>{

// })



const getAppAccessToken = async () => {
//get app access token

    var tokenOptions = {
        url: `https://id.twitch.tv/oauth2/token?` + 
            queryString.stringify({
                client_id: clientID,
                client_secret: clientSecret,
                grant_type: 'client_credentials',
                scope: 'channel:read:redemptions' // modify this depending on your subscription types(if providing multiple, separate with a space: ' ')
            }),
        method: 'POST'
    };

    let appAccessToken = await new Promise((resolve, reject)=>{
        
        request(tokenOptions, (error, response)=>{
            console.log(response.body);
            if(!error){
                resolve(JSON.parse(response.body).access_token);
            } else {
                console.log(error);
            }
        });
    });
    console.log(appAccessToken);
    return appAccessToken;
};


const validateToken = async (appAccessToken) => {
//validate app access token
    var headers = {
        'Authorization': 'OAuth ' + appAccessToken
    };
    
    var validationOptions = {
        url: 'https://id.twitch.tv/oauth2/validate',
        headers: headers
    };

    let isTokenValid = await new Promise((resolve, reject)=> {
        request(validationOptions, (error, response)=>{
            let parsedResponse = JSON.parse(response.body)

            if(!parsedResponse.status){
                // console.log(parsedResponse.status);
                resolve(true)
            } else {
                resolve(false)
            }
        });
    });

    return isTokenValid;
}

            
const createNewSubscription = async (appAccessToken, broadcaster_id, subscriptionType) => {

    var subscriptionHeaders = {
        'Client-ID': clientID,
        'Authorization': 'Bearer ' + appAccessToken,
        'Content-Type': 'application/json'
    };

    var dataString = JSON.stringify({
        "type": subscriptionType,
        "version": "1",
        "condition": {
            "broadcaster_user_id": broadcaster_id
        },
        "transport": {
            "method": "webhook",
            "callback": callbackURL, // -- endpoint must match express endpoint
            "secret": "qwerty123456" //your secret
        }
    })
    
    var subscriptionOptions = {
        url: 'https://api.twitch.tv/helix/eventsub/subscriptions',
        method: 'POST',
        headers: subscriptionHeaders,
        body: dataString
    };

    let newSubscriptionCreated = await new Promise((resolve, reject)=>{
        request(subscriptionOptions, (error, response)=>{
            let parsedResponse = JSON.parse(response.body)
            
            if(!parsedResponse.error){
                resolve(parsedResponse)
            } else {
                console.log(parsedResponse)
            }

        })
    })

    return newSubscriptionCreated;
}


const getAllSubscriptions = async (appAccessToken) => {
//get all existing subscriptions

    var headers = {
        'Client-ID': clientID,
        'Authorization': 'Bearer ' + appAccessToken
    };
    
    var getListOptions = {
        url: 'https://api.twitch.tv/helix/eventsub/subscriptions',
        headers: headers
    };

    let allSubscriptions = await new Promise((resolve, reject)=>{
        request(getListOptions, (error, response)=>{
            let parsedResponse = JSON.parse(response.body)
            if(!parsedResponse.error){
                resolve(parsedResponse)
            } else {
                parsedResponse.map((data)=>{
                    if(data.status !== 'webhook_callback_verification_failed')
                        console.log(data);
                });
            }
            
        })
    })

    return allSubscriptions;
}


const deleteSubscription = async (appAccessToken, subscriptionID) => {

    var headers = {
        'Client-ID': clientID,
        'Authorization': 'Bearer ' + appAccessToken
    };
    
    var deleteOptions = {
        url: 'https://api.twitch.tv/helix/eventsub/subscriptions?id=' + subscriptionID,
        method: 'DELETE',
        headers: headers
    };

    let deletionStatus = await new Promise((resolve, reject)=>{
        request(deleteOptions, (error, response)=>{
            if(response.body === ''){
               resolve('successessfully deleted sub of id: ' + subscriptionID)
            } else {
                console.log(response.body)
            }
        })
    })

    return deletionStatus;
}


//Handles all function calls
const eventSubHandler = async () => {

    let appAccessToken = await getAppAccessToken()

    let isTokenValid = await validateToken(appAccessToken)

    if(!isTokenValid){
        //if app access token is invalid then get a new one
        appAccessToken = await getAppAccessToken()
    }

    //broadcaster_id and subscriptionType should be set for your specific requirements
    let broadcaster_id = process.env.BROADCASTER_ID; // the channel you would like the subscription set up on
    let subscriptionType = 'channel.follow'; // the type of subscription you would like   ref: https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types
    //creates new subscription
    // let newSubscription = await  createNewSubscription(appAccessToken, broadcaster_id, subscriptionType)

    let subscriptionList = await getAllSubscriptions(appAccessToken)
    console.log(subscriptionList)

    //deletes first subscription in subscriptionList -- change 'subscriptionList.data[0].id with the id of the specific subscription you would like deleted
    let runDelete = false //set to true if you want to run deletion sequence
    if(runDelete === true && subscriptionList.data.length > 0){
        let deletionStatus = await deleteSubscription(appAccessToken, subscriptionList.data[0].id)
        console.log(deletionStatus)
    }
}

eventSubHandler();


//request handler - receives requests from ngrok
// app.post('/', jsonParser, (req, res)=>{
    
//     //to validate that you own the callback you must return the challenge back to twitch
//     console.log(req.body);
    
//     if(req.body.challenge){
//         res.send(req.body.challenge)
//     } else {
//         console.log(req.body);
//         //response to twitch with 2XX status code if successful (prevents multiple of the same notifications)
//         res.send('2XX')
//     }
// })

app
    .route('/')
    .get((req, res) => {
        console.log('Incoming Get request on /');
        res.send('There is no GET Handler');
    })
    .post((req, res) => {
        console.log('Incoming Post request on /');

        // the middleware above ran
        // and it prepared the tests for us
        // so check if we event generated a twitch_hub
        if (req.twitch_eventsub) {
            // is it a verification request
            if (req.headers['twitch-eventsub-message-type'] == 'webhook_callback_verification') {
                // it's a another check for if it's a challenge request
                if (req.body.hasOwnProperty('challenge')) {
                // we can validate the signature here so we'll do that
                    if (req.twitch_hex == req.twitch_signature) {
                        console.log('Got a challenge, return the challenge');
                        res.send(encodeURIComponent(req.body.challenge));
                        return;
                    }
                }
                // unexpected hook request
                res.status(403).send('Denied');
            } else if (req.headers['twitch-eventsub-message-type'] == 'revocation') {
                // the webhook was revoked
                // you should probably do something more useful here
                // than this example does
                res.send('Ok');
            } else if (req.headers['twitch-eventsub-message-type'] == 'notification') {
                if (req.twitch_hex == req.twitch_signature) {
                    console.log('The signature matched');
                    // the signature passed so it should be a valid payload from Twitch
                    // we ok as quickly as possible
                    res.send('Ok');

                    // you can do whatever you want with the data
                    // it's in req.body

                    // write out the data to a log for now
                    fs.appendFileSync(path.join(
                        __dirname,
                        'webhooks.log'
                    ), JSON.stringify({
                        body: req.body,
                        headers: req.headers
                    }) + "\n");
                    // pretty print the last webhook to a file
                    fs.appendFileSync(path.join(
                        __dirname,
                        'last_webhooks.log'
                    ), JSON.stringify({
                        body: req.body,
                        headers: req.headers
                    }, null, 4));
                } else {
                    console.log('The Signature did not match');
                    // the signature was invalid
                    res.send('Ok');
                    // we'll ok for now but there are other options
                }
            } else {
                console.log('Invalid hook sent to me');
                // probably should error here as an invalid hook payload
                res.send('Ok');
        }
     } else {
            console.log('It didn\'t seem to be a Twitch Hook');
            // again, not normally called
            // but dump out a OK
            res.send('Ok');
        }
    });


//setup express server and ngrok connection
const server = app.listen(process.env.PORT, ()=> {
    console.log(`Listening on port ${process.env.PORT}`);
});
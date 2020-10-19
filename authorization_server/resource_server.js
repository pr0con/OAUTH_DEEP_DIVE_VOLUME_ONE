//Native
const https = require('https');

//3rd Party
const cors = require('cors');
const express = require('express');

//Our Packages
const utils = require('../node_systems/utilz.js');	//using external lib@ ../node_systems
const Mongo = require('../node_systems/mongo.js');	//using external lib@ ../node_systems


//define app
const app = express();

//apply middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({origin: true, credentials: true}));

https.createServer({
	key: utils.k3yc3r7.key,
	cert: utils.k3yc3r7.cert
},
app).listen(1600, () => {
	utils.logData('Resource Server : 1600');
	
	app.use(function(err, req, res, next) {
		if(!err) {
			next();
		}else if(err) {
			console.log(err);
		}
	});
	
	app.post('/validate_access_token', async (req, res, next) => {
		let header_bearer_at = req.headers['authorization'];
		//console.log(header_bearer_at);
		//console.log(req.body);


		/* 
			simulate fetch resource (test)
			also our at is encrypted and we are using an LCID (life cycle id) custom idea
			
			possible tranfer methods of access tokens
			- access token provided through header
			- access token provided through req.body
			- access token provide through query params
		*/
		var encrypted_refresh_token = null;
		if(header_bearer_at && header_bearer_at.toLowerCase().indexOf('bearer') == 0) { //method we are using....
			encrypted_refresh_token = header_bearer_at.slice('bearer '.length);	
		}else if(req.body && 'access_token' in req.body) { //not implemented
			encrypted_refresh_token = req.body.access_token;
		}else if(req.query & req.query.access_token) { //not implented
			encrypted_refresh_token = req.query.access_token;
		}
		
		let error_msg = '';
		let lcid_record = await Mongo.findOne('CLIENT_LCIDs', {lcid: req.body.lcid});
		if(lcid_record) {
			//possibly wrap with try catch up to you to handle errors at this point
			let decrypted_refresh_token = await utils.decryptData(encrypted_refresh_token, lcid_record.iv.buffer, lcid_record.key.buffer);
			let vrt = await utils.verifyRefreshToken(decrypted_refresh_token);	 //vrt = verified refresh token
			
			if(vrt) { //verify lcid in reuqest is same as refresh token JTI
				if(vrt.jti === req.body.lcid) {
					/*
						we are verified at this point you have access to all the user information
						the scopes in the lcid_record etc etc to do whatever you need for further access verification
				    */
					
					//return just a json string as resource... could be any resource...
					res.status(200).json({success: true, message: 'I am protected resource'});
					return 
				}
				else { error_msg = 'Client LCID Mismatch'; }
			}
			else { error_msg = 'Unable to verify access_token'; }
		}
		else { error_msg = 'No CLIENT LCID Record'; }
		
		//we will do one return here if code gets to this point
		//you could do a seperate return for each error or set a variable with error message
		//to add some sort of alert as to where error occured like in auth server 
		res.status(404).json({ success: false, message: error_msg});	
	});
});

process.on('unhandledRejection', (err,promise) => {
	console.log(`Caught Promise Rejection @resource_server.js: ${err.message}`);
});
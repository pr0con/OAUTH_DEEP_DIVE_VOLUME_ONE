//Native
const https = require('https');

const cors = require('cors');
const express = require('express');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const ObjectId = require('mongodb').ObjectID;

//https://github.com/ai/nanoid
const { nanoid } = require('nanoid');

const utils = require('../node_systems/utilz.js');	//using external lib@ ../node_systems
const Mongo = require('../node_systems/mongo.js');	//using external lib@ ../node_systems

//define app
const app = express();

//apply middleware
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cors({origin: true, credentials: true}));
app.use(express.static('./dist'));
app.use(cookieParser());

https.createServer({
	key: utils.k3yc3r7.key,
	cert: utils.k3yc3r7.cert
},
app).listen(1500, () => {
	utils.logData('Authorization server running on 1500');
	
	app.use(function(err,req,res,next) {
		res.header('Access-Control-Allow-Credentials', true);
		res.header('Access-Control-Allow-Origin', 'pr0con.com');
		res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS'); //usually per route
		res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
		
		(!err) ? next() : (err) ? console.log(err) : '';		
	});
	
	app.get('/authorize', async (req,res,next) => {
		let path = req.params[0] ? req.params[0] : 'index.html';
		res.sendFile(path, {root: './dist'});
	});
	
	app.post('/authorize_app', async (req, res, next) => {
		find = {
			$or: [
				{email: req.body['username']},
				{alias: req.body['username']}
			]
		}
		
		let user = await Mongo.findOne('users', find);
		if(user) {			
			let vp = await utils.bcryptValidatePassword(req.body.password, user['password']); //validate password
			if(vp) {
				let vu 	= await Mongo.findOne('clients', {'_id': ObjectId(req.body.client_id), users: {'$in': [ ObjectId(user._id) ]}}); //valid user in client white-list
				//vu contains at this point our client information
				
				
				if(vu && 'response_type' in req.body && req.body.response_type == "code") {
					//to do...
					//check scopes are allowed scopes
					//check that redirect uri in allowed uri array
					//wrap this logic below with those two checks....
					
					
					let init_auth_token = nanoid(48);
					
					let d = new Date();
					let exp = d.setTime(d.getTime()+(5*60*1000)) //5 minutes
					
					/*
						use the dying state param as secret key which will only exist
						as PSID_<Client_Id> value on return to callback....
						
						- encrypt / return nanoid
						- upon access_token / refresh_token request try decrypting init_auth_token.... 
						- lots of dying moving pieces working together to form a custom securtiy mechanism
					*/
					let encrypted_auth_code = await utils.encryptAuthCode(req.body.state, init_auth_token); 
					let client_request_id = await utils.generateLifeCycleId();
					
					let new_iat = await Mongo.insertOne('authorization_codes',{
						owner: user._id,
						lcid: client_request_id.lcid,
						client_id: req.body.client_id,
						init_auth_token,
						exp,
						iv: encrypted_auth_code.iv,
						padding: encrypted_auth_code.padding,
						padding_length: encrypted_auth_code.padding_length,
						scope: vu.scope, //could allow for modified scopes less than client has access to... 
					});
					
					let client_lcid_record = await Mongo.insertOne('CLIENT_LCIDs', client_request_id);
					
					if(new_iat && client_lcid_record && '_id' in new_iat) {
						res.status(200).json({
							success: true,
							send_to: `${req.body.redirect_uri}?client_id=${req.body.client_id}&code=${encrypted_auth_code.encrypted_code}&state=${req.body.state}&lcid=${client_lcid_record.lcid}`
						});
						utils.logData('Authorization Record Created.');	
						
						return;
					}else {
						res.status(200).json({success: false, message: 'Error inserting Init Auth Code Record Or CLIENT_LCID record'});	
					}
				}else {
					res.status(200).json({success: false, message: 'Suspicious Activity Detected'});
				}	
			}else {
				res.status(200).json({success: false, message: 'Authentication Malfunction'});
			}		
		}else {
			res.status(200).json({success: false, message: 'No User Found'});
		}
	});
	
	
	//make another check to make sure client exists...
	app.post('/token', async(req,res,next) => {
		//console.log(req.body);
		if(req.headers['authorization']) {
			if('grant_type' in req.body && req.body.grant_type === 'authorization_code') {	
				let basic_auth_data = req.headers['authorization'].split(' ')[1];
					basic_auth_data = basic_auth_data.split(':'); 
					//basic_auth_data[0] == client_id
					//basic_auth_data[1] == lcid
			
				//attempt to decypt code using param_key in body
				let auth_req_record = await Mongo.findOne('authorization_codes', {'client_id': basic_auth_data[0], lcid: basic_auth_data[1] });
				if(auth_req_record) {
					//console.log(auth_req_record);
					
					let decrypted_auth_code = await utils.decryptAuthCode(req.body.code, req.body.param_key, auth_req_record.padding, auth_req_record.padding_length, auth_req_record.iv);
					if(decrypted_auth_code === auth_req_record.init_auth_token) {
						let owner = await Mongo.findOne('users', {'_id': auth_req_record.owner});
						
						if(owner) {
							owner['password'] = 'F00';
							
							//create access token and refresh token with lcid record
							let lcid_record = await Mongo.findOne('CLIENT_LCIDs', {lcid: req.body.lcid});
							//console.log(lcid_record);
							
							let access_token = await utils.generateClientJWT('ACCESS_TOKEN', owner, auth_req_record.scope, lcid_record.lcid);
							let refresh_token = await utils.generateClientJWT('REFRESH_TOKEN', owner, auth_req_record.scope, lcid_record.lcid);
							
					
							let encrypted_access_token = await utils.encryptData(access_token, lcid_record.iv.buffer, lcid_record.key.buffer);
							let encrypted_refresh_token = await utils.encryptData(refresh_token, lcid_record.iv.buffer, lcid_record.key.buffer);
								
							res.cookie(basic_auth_data[0]+'_rt', encrypted_refresh_token, { expires: new Date(Date.now() + 86400000), httpOnly: true, secure: true}); //exp 24hrs 60 * 60 * 24 * 1000
							res.status(200).json({success: true, message: 'Authorization Granted with Tokens', lcid: lcid_record.lcid, access_token: encrypted_access_token, refresh_token: encrypted_refresh_token });
			
							//at this point remove init_auth_record...
							let delete_auth_code_record_result = await Mongo.deleteOneByKV('authorization_codes', {init_auth_token: decrypted_auth_code});
							utils.logData('Init Authorization Record Purged.');
							return
						}else {
							utils.logData('Invalid Auth Request Owner');
							res.status(401).json({success: false, message: 'unowned_auth_request'});	
						}
					}else {
						utils.logData('Invalid Initial Authentication Token (Mismatch)');
						res.status(401).json({success: false, message: 'bad_init_auth_token'});					
					}
				}else if(!auth_req_record) {
					utils.logData('Unknown client or No Auth Request Request Found');
					res.status(401).json({success: false, message: 'unknown_client_or_no_auth_record'});	
				}
			} else {
				utils.logData('Missing / Invalid or Unsupported Grant Type');
				res.status(401).json({success: false, message: 'missing_invalid_unsupported_grant_type'});
			}
		}else {
			utils.logData('Authorization Header Missing.');
			res.status(401).json({success: false, message: 'authorization_header_missing'});
		}
	});
	
	//make another check to make sure client exists....
	app.post('/refresh_token_via_grant_type', async(req, res, next) => {
		//console.log(req.body);
		if(req.headers['authorization']) {
			if('grant_type' in req.body && req.body.grant_type === 'refresh_token') {	
				let basic_auth_data = req.headers['authorization'].split(' ')[1];
					basic_auth_data = basic_auth_data.split(':'); 
					//basic_auth_data[0] == client_id
					//basic_auth_data[1] == lcid
					
					//verify valid client_id here if you want... 
					let lcid_record = await Mongo.findOne('CLIENT_LCIDs', {lcid: basic_auth_data[1]});
					
					if(lcid_record) {
						
	
						let decrypted_refresh_token = await utils.decryptData(req.body.refresh_token, lcid_record.iv.buffer, lcid_record.key.buffer);
						let vrt = await utils.verifyRefreshToken(decrypted_refresh_token);	 //vrt = verified refresh token
						
						if(vrt) {
							//Extra Security Check Here..
							if(basic_auth_data[1] === vrt.jti) { //verify lcid in reuqest is same as refresh token JTI 	
							
								//console.log(vrt); //we need info from this...	this is decrypted refresh token
								
								let fresh_owner = await Mongo.findOne('users', {'_id': ObjectId(vrt.owner._id)});
								if(fresh_owner) {
									fresh_owner['password'] = 'F00';
								
									//possibly wrap with try catch up to you to handle errors at this point
									let access_token = await utils.generateClientJWT('ACCESS_TOKEN', fresh_owner, vrt.scope, lcid_record.lcid);
									let refresh_token = await utils.generateClientJWT('REFRESH_TOKEN', fresh_owner, vrt.scope, lcid_record.lcid);
								
									let encrypted_access_token = await utils.encryptData(access_token, lcid_record.iv.buffer, lcid_record.key.buffer);
									let encrypted_refresh_token = await utils.encryptData(refresh_token, lcid_record.iv.buffer, lcid_record.key.buffer);
								
								
									res.cookie(basic_auth_data[0]+'_rt', encrypted_refresh_token, { expires: new Date(Date.now() + 86400000), httpOnly: true, secure: true}); //exp 24hrs 60 * 60 * 24 * 1000
									res.status(200).json({success: true, message: 'Refreshed Client Access Tokens', access_token: encrypted_access_token, refresh_token: encrypted_refresh_token });
									
									utils.logData('Refreshed Client Access Via Grant Type.');
									return		
									
								} else {
									//Remove CLIENT_LCID Record!!!
									
									utils.logData('Bad Owner : Kill All Access');
									res.status(401).json({success: false, message: 'bad_owner_kill_all_access'});										
								}
							}else {
								//Remove CLIENT_LCID  Record!!!
								
								utils.logData('LCID Mismatch (Req.Lcid with RT.lcid)');
								res.status(401).json({success: false, message: 'lcid_mismatch_kill_all_access'});								
							}
							
						}else {
							//Remove CLIENT_LCID  Record!!!
							
							utils.logData('Bad Refresh Token : Kill All Access');
							res.status(401).json({success: false, message: 'bad_refresh_token_kill_all_access'});								
						}
						
					}else {
						//Remove CLIENT_LCID  Record!!!
						
						utils.logData('Missing / Invalid Client LCID');
						res.status(401).json({success: false, message: 'missing_invalid_client_lcid_kill_all_access'});								
					}		
			}else {
				utils.logData('Missing / Invalid or Unsupported Grant Type');
				res.status(401).json({success: false, message: 'missing_invalid_unsupported_grant_type'});				
			}
		}else {
			utils.logData('Authorization Header Missing.');
			res.status(401).json({success: false, message: 'authorization_header_missing'});			
		}
			
	});
	
	app.post('/refresh_token_via_cookie', async(req, res, next) => {
		if(req.headers['authorization']) {
			if('grant_type' in req.body && req.body.grant_type === 'refresh_token') {	
				let basic_auth_data = req.headers['authorization'].split(' ')[1];
					basic_auth_data = basic_auth_data.split(':'); 
					//basic_auth_data[0] == client_id
					//basic_auth_data[1] == lcid					
					
				if([basic_auth_data[0]+'_rt'] in req.cookies) { 
					//console.log(req.cookies[basic_auth_data[0]+'_rt']);
					let encrypted_refresh_token = req.cookies[basic_auth_data[0]+'_rt'];		
					let lcid_record = await Mongo.findOne('CLIENT_LCIDs', {lcid: basic_auth_data[1]});
					
					if(lcid_record) {
						let decrypted_refresh_token = await utils.decryptData(encrypted_refresh_token, lcid_record.iv.buffer, lcid_record.key.buffer);
						
						let vrt = await utils.verifyRefreshToken(decrypted_refresh_token);	 //vrt = verified refresh token
						if(vrt) {
							if(basic_auth_data[1] === vrt.jti) { //verify lcid in reuqest is same as refresh token JTI 
								let fresh_owner = await Mongo.findOne('users', {'_id': ObjectId(vrt.owner._id)});
								if(fresh_owner) {
									fresh_owner['password'] = 'F00';
									
									//possibly wrap with try catch up to you to handle errors at this point
									let access_token = await utils.generateClientJWT('ACCESS_TOKEN', fresh_owner, vrt.scope, lcid_record.lcid);
									let refresh_token = await utils.generateClientJWT('REFRESH_TOKEN', fresh_owner, vrt.scope, lcid_record.lcid);
								
									let encrypted_access_token = await utils.encryptData(access_token, lcid_record.iv.buffer, lcid_record.key.buffer);
									let encrypted_refresh_token = await utils.encryptData(refresh_token, lcid_record.iv.buffer, lcid_record.key.buffer);
																
									res.cookie(basic_auth_data[0]+'_rt', encrypted_refresh_token, { expires: new Date(Date.now() + 86400000), httpOnly: true, secure: true}); //exp 24hrs 60 * 60 * 24 * 1000
									res.status(200).json({success: true, message: 'Refreshed Client Access Tokens', access_token: encrypted_access_token, refresh_token: encrypted_refresh_token });
									
									utils.logData('Refreshed Client Access Via Cookie.');
									return		
									
								} else {
									//Remove CLIENT_LCID Record!!!
									
									utils.logData('Bad Owner : Kill Client Access');
									res.status(401).json({success: false, message: 'bad_owner_kill_all_access'});										
								}								
								
							}else {
								//Remove CLIENT_LCID  Record!!!
								
								utils.logData('LCID Mismatch (Req.Lcid with RT.lcid)');
								res.status(401).json({success: false, message: 'lcid_mismatch_kill_all_access'});																
							}								
						}else {	
							//Remove CLIENT_LCID  Record!!!
							
							utils.logData('Bad Refresh Token : Kill Client Access');
							res.status(401).json({success: false, code:'bad_refresh_token_kill_all_access', message: 'Bad Refresh Token' });								
						}												
					}else {
						//Remove CLIENT_LCID  Record!!!
						
						utils.logData('Missing / Invalid Client LCID');
						res.status(401).json({success: false, message: 'missing_invalid_client_lcid_kill_all_access'});								
					}					
				}else {
					utils.logData('Missing Client Cookie Rfresh Token');
					res.status(401).json({success: false, message: 'missing_client_cookie_refresh_token'});					
				}
		    } else {
				utils.logData('Missing / Invalid or Unsupported Grant Type');
				res.status(401).json({success: false, message: 'missing_invalid_unsupported_grant_type'});				
			}
		} else {
			utils.logData('Authorization Header Missing.');
			res.status(401).json({success: false, message: 'authorization_header_missing'});			
		}			
	});
});

process.on('unhandledRejection', (err,promise) => {
	console.log(`Caught Promise Rejection @authorization_server.js: ${err.message}`);
});






	
const utils = require('../utilz.js');
const express = require('express');

const router = express.Router();
const mongo = require('../mongo.js');
const expressJWT = require('express-jwt');
const ObjectId = require('mongodb').ObjectID;


router.post('/api/auth/login', async (req,res) => {
	if([req.body.username, req.body.password].includes('')) {
		return res.status(400).json({success: false, message: 'User not found.'});
	}
	
	
	let tokens_with_user = null;
	tokens_with_user = await mongo.AuthenticateUser(req.body);
	
	if(tokens_with_user !== false && tokens_with_user !== null) {
		let nd = new Date().toISOString();
		tokens_with_user['user']['last_login'] = nd;
		
		//ullr = update last login result
		let ullr = await mongo.updateOne('users', {'_id': new ObjectId(tokens_with_user['user']['_id'])}, {'$set': {'last_login': nd}});
		utils.logData(`Modified Records (${ullr})`);	
		
		res.cookie('refresh_token', tokens_with_user['refresh_token'], { expires: new Date(Date.now() + 86400000), httpOnly: true, secure: true}); //exp 24hrs 60 * 60 * 24 * 1000
		res.status(200).json({success: true, message: 'User Logged In.', lcid: tokens_with_user['lcid'], access_token: tokens_with_user['access_token'], user: tokens_with_user['user'] });
		
			
	} else if(tokens_with_user === false || tokens_with_user === null) {
		res.status(401).json({success: false, message: 'Horrible Credentials'})
	}
	
});

router.post('/api/auth/refresh_token', async (req,res) => {
	if('grant_type' in req.body && req.body.grant_type === 'refresh_token') {
		if('refresh_token' in req.cookies) {
			let lcid_record = await mongo.findOne('LCIDs', {lcid: req.body.LCID});
			//console.log(lcid_record.iv.buffer);
			//console.log(lcid_record.key.buffer);
			
			if(lcid_record) {
				let decrypted_refresh_token = await utils.decryptData(req.cookies.refresh_token, lcid_record.iv.buffer, lcid_record.key.buffer);
				let vrt = await utils.verifyRefreshToken(decrypted_refresh_token);	 //vrt = verified refresh token
				
				//console.log('DRT: ', decrypted_refresh_token);
				//console.log('VRT: ', vrt);
					
				if(vrt) {
					//may want to update last login here before fetching fresh_user... up to you...
					let nd = new Date().toISOString();
					let ullr = await mongo.updateOne('users', {'_id': new ObjectId(vrt.user._id)}, {'$set': {'last_login': nd}});
					utils.logData(`Modified Records (${ullr})`);		
								
					let fresh_user = await mongo.findOne('users', {'_id': ObjectId(vrt.user._id)});
					fresh_user['password'] = 'F00';
					
					let access_token = await utils.generateJwt(fresh_user, 'ACCESS_TOKEN');
					let refresh_token = await utils.generateJwt(fresh_user, 'REFRESH_TOKEN');
					
					
					let encrypted_access_token = await utils.encryptData(access_token, lcid_record.iv.buffer, lcid_record.key.buffer);
					let encrypted_refresh_token = await utils.encryptData(refresh_token, lcid_record.iv.buffer, lcid_record.key.buffer);
					
					res.cookie('refresh_token', encrypted_refresh_token, { expires: new Date(Date.now() + 86400000), httpOnly: true, secure: true}); //exp 24hrs 60 * 60 * 24 * 1000
					res.status(200).json({success: true, message: 'User session refreshed.',  access_token: encrypted_access_token, user: fresh_user });
				} else {
					res.status(200).json({ success: false, code: 'invalid-refresh-decryption-verification', message: "Unable to decrypt Refresh Token or Find User Data" });
				}	
			} else {
				res.status(200).json({ success: false, code: 'missing-lcid', message: "Missing LCID Record." });
			}
		}
		else {
			res.status(200).json({ success: false, code: 'missing-refresh-token', message: "Refresh Token Missing from Cookies." });
		}
	}else {
		res.status(200).json({ success: false, code: 'missing-grant-type-invalid', message: "Missing Grant Type or Invalid" });
	}
});


module.exports = router;
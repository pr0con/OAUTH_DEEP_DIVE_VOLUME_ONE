const os = require('os');
const fs = require('fs');



const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

//used with the websockets generated serverside...
const CSRFTokens = require('csrf');
const csrfTokens = new CSRFTokens();

const { v1: uuidv1 } = require('uuid');
const { v4: uuidv4 } = require('uuid');

const crypto = require("crypto");
const algorithm = "aes-192-cbc"; 
const password = "WHATEVERYOUWANT";

//for client secret generation...
const base64url = require('base64url');
const Str = require('@supercharge/strings');

const k3yc3r7 = {
	key: fs.readFileSync('/etc/letsencrypt/live/void.pr0con.com/privkey.pem'),
	cert: fs.readFileSync('/etc/letsencrypt/live/void.pr0con.com/fullchain.pem')
}

let jwtPublicKey = fs.readFileSync('/var/www/keycertz/mykey.pub', 'utf8');
let jwtPrivateKey = fs.readFileSync('/var/www/keycertz/mykey.pem', 'utf8');

const system_configuration = {
	"letsencrypt": {
		"public_key_path": "/etc/letsencrypt/live/void.pr0con.com/fullchain.pem",
		"private_key_path": "/etc/letsencrypt/live/void.pr0con.com/privkey.pem",	
	},
	"databases": {
		"mongo": {
			"url": "mongodb://mongod:SOMEHARDPASSWORD@127.0.0.1:27017?authMechanism=SCRAM-SHA-1&authSource=admin"
		}
	},
	"oauth": {
		"jwt_secret": "WHATEVERYOUWANT",
		"jwt_claims": {
			issuer: "void.pr0con.com", 		//who create the token and signs it
			audience: "void.pr0con.com",	//to whom the token use is intended for (sent to)
			expiresIn: "30m", 				//time when the token will expire (30m default)
			jwtid: "",						//a unique identifier for the token
			notBefore: "0",					//time before which the token is not yet valid (0 miliseconds ago)
			subject: "Development Services", //the subject/prinicipal is what the token is about
			algorithm: "RS256",
			//add custom key values here
		},
		"at_verify_options": {
			issuer: "void.pr0con.com", 	
			audience: "void.pr0con.com"	,
			subject: "Development Services",
			algorithm: "RS256",
			expiresIn: "30m",
		},
		"rt_verify_options": {
			issuer: "void.pr0con.com", 	
			audience: "void.pr0con.com"	,
			subject: "Development Services",
			algorithm: "RS256",	
			expiresIn: "24h",	
		}
	}
}

function logData(message) {
	var d = new Date()
	var time = '[' + d.getHours() + ':' + d.getMinutes() + ':' + d.getSeconds() + ']';
	
	console.log(time + ' ' + message);
}

function decodeBase64(data) {
	let buff = Buffer.from(data, 'base64');
	let text = buff.toString('ascii');
	return text
}

async function bcryptGeneratePassword(p) {
	return await bcrypt.hash(p,10);
}

async function bcryptValidatePassword(p,h) {
	return await bcrypt.compare(p,h);
}

async function generateCSRFToken() {
	const secret = csrfTokens.secretSync();
	const token = csrfTokens.create(secret);
	
	return { csrf_token: token, csrf_secret: secret }
}

async function verifyCSRFToken(csrf_token, csrf_secret) {
	/*
		Validate Token from incoming message (not from the found object)
		Use secret from findOne doc.	
	*/
	if(csrfTokens.verify(csrf_secret, csrf_token)) {
		return true;
	} else {
		return false;	
	}
}


async function generateJwt(user, token_type) {
	let claims = system_configuration['oauth']['jwt_claims'];
	claims['jwtid'] = uuidv1();
	
	let scopes = {
		api: 'restricted_access'
	}
	
	switch(user['role']) {
		case "admin":
			scopes['api'] = 'admin_access';
			break;
		case "user":
			scopes['api'] = 'user_access';
			break;
		default:
			break;
	}
	switch(token_type) {
		case "ACCESS_TOKEN":
			break;
		case "REFRESH_TOKEN":
			claims['expiresIn'] = "24h"
			break;
		default:
			break;
	}
	
	let token = jwt.sign({token_type, user, scopes}, {key: jwtPrivateKey, passphrase: system_configuration['oauth']['jwt_secret'] }, claims);	
	return token;
}

//add custum values verification..., double check verify options documentation.. 
//valid options (issuer, audience, subject) (ignores custum values, expires, algorithm)
async function verifyAccessToken(access_token) {
	try {
		let legit = jwt.verify(access_token, jwtPublicKey, system_configuration['oauth']['at_verify_options']);
		return legit;
	}catch(err) {
		console.log(err);
		return false;
	}
	return false;
}

async function verifyRefreshToken(refresh_token) {
	try {
		let legit  = jwt.verify(refresh_token, jwtPublicKey, system_configuration['oauth']['rt_verify_options']);
		return legit;
	}catch(error) {
		console.log(error);
		return false;
	}
	return false;
}


async function generateLifeCycleId() {
	const lcid = uuidv4();
	const iv = crypto.randomBytes(16); //generate different cyphertext everytime we create LCID
	const key = crypto.scryptSync(password, 'salt', 24);
	
	let d = new Date();
	let exp = d.setTime(d.getTime() +(60*60*24*1000)); //expire in 24hrs like access token	
	
	return { lcid, iv, key, exp }
}

async function encryptData(data, iv, key) {
	const cipher = crypto.createCipheriv(algorithm, key, iv);
	const encrypted = cipher.update(data, 'utf8', 'hex') + cipher.final('hex');
	
	return encrypted;
}


async function decryptData(data, iv, key) {
	const decipher = crypto.createDecipheriv(algorithm, key, iv);
	let decrypted = decipher.update(data, 'hex', 'utf8') + decipher.final('utf8');
	
	return decrypted;
}



function payload(type, data) {
	let payload = {
		type,
		data
	}
	return payload
}

function randomStringAsBase64Url(size) {
	return base64url(crypto.randomBytes(size));
}


/* Oauth 2.0 Custom Funcs */
const  auth_code_alg = "aes-256-ctr"; 


async function encryptAuthCode(param_key, auth_code) {
	let padding_length = 32	- param_key.length;
	let padding = (padding_length > 0) ? Str.random(padding_length) : '';
	
	if(padding_length < 0) {
		param_key = param_key.substring(0, param_key.length + padding_length); //add negative number to remove characters
	}
	
	const iv = crypto.randomBytes(16);
	const cipher = crypto.createCipheriv(auth_code_alg, Buffer.from(param_key+padding, 'utf8'), iv) //key must be 256 bit (32 char)
	const encrypted = Buffer.concat([cipher.update(auth_code), cipher.final()]);
	
	return {
		iv: iv.toString('hex'),
		padding,
		padding_length,
		encrypted_code: encrypted.toString('hex')
	}
}

async function decryptAuthCode(encrypted_auth_code, param_key, padding, padding_length, iv) {
	//console.log('ac: ',encrypted_auth_code);
	//console.log('pk: ',param_key);
	//console.log('padding: ', padding);
	//console.log('padding_length: ', padding_length);
	//console.log('iv: ', iv);
	
	if(padding_length < 0) {
		param_key = param_key.substring(0, param_key.length + padding_length); //add negative number to remove characters
	}
	
	const decipher = crypto.createDecipheriv(auth_code_alg, param_key+padding, Buffer.from(iv, 'hex'));
	const decrypted = Buffer.concat([decipher.update(Buffer.from(encrypted_auth_code, 'hex')), decipher.final()]);
	
	return decrypted.toString();
}

//custom flow here match lcid record with tokens jwtid -- just for pairing...
async function generateClientJWT(token_type, owner, scope, lcid) {
	let claims = system_configuration['oauth']['jwt_claims'];
	claims['jwtid'] = lcid;	

	switch(token_type) {
		case "ACCESS_TOKEN":
			break;
		case "REFRESH_TOKEN":
			claims['expiresIn'] = "24h"
			break;
		default:
			break;
	}
	
	let token = jwt.sign({token_type, owner, scope}, {key: jwtPrivateKey, passphrase: system_configuration['oauth']['jwt_secret'] }, claims);	
	return token;	
}

/* Client AT and RT Using same Verification function for AT and RT as master login */


module.exports = {
	k3yc3r7,
	system_configuration,
	
	logData,
	decodeBase64,
	
	bcryptGeneratePassword,
	bcryptValidatePassword,
	
	generateCSRFToken,
	verifyCSRFToken,
		
	generateJwt,
	verifyAccessToken,
	verifyRefreshToken,	
	generateLifeCycleId,
	
	ArrayBufferToString: function(buffer, encoding) {
		if (encoding === null) encoding = 'utf8';
		return Buffer.from(buffer).toString(encoding);
	},
	
	encryptData,
	decryptData,
	
	payload,
	randomStringAsBase64Url,

	encryptAuthCode,
	decryptAuthCode,
	
	generateClientJWT,
}
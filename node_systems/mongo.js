const utils = require('./utilz.js');

const mongo = require('mongodb');
const ObjectId = require('mongodb').ObjectID;
const MongoClient = require('mongodb').MongoClient;


MongoClient.connect(utils.system_configuration['databases']['mongo']['url'], {useUnifiedTopology: true, useNewUrlParser: true }, ConfigureAPI);

/* Internal Configuration */
let db = null;
let api = null;
let admin = null;

async function ConfigureAPI(err, db_) {
	if(!err) {
		db = db_;
		api = db_.db('api');
		admin = db_.db('admin').admin();
		
		utils.logData("Async Mongo Connected & API Configured");
	}
	if(err) { utils.logData("Async Mongo Failed."); return; }
}


async function insertOne(col, doc) {
	let res = await api.collection(col).insertOne(doc).then((result) => {
		return doc; //this will return the doc with the inserted Id!!!
	});
	
	return doc;
}

async function findOne(col, q) {
	let doc = await api.collection(col).findOne(q);

	return doc;
}

async function updateOne(col,q, set) {
	let ur = await api.collection(col).updateOne(q, set);
	return ur['modifiedCount'];
}


async function deleteOneByKV(col, q) {
	let del_result = await api.collection(col).deleteOne( q );	
	(del_result['deletedCount'] === 1) ? utils.logData('Document Purged.') : utils.logData('No Documents removed.');
}

async function deleteOneByOID(col,oid) {
	let del_result = await api.collection(col).deleteOne({'_id': ObjectId(oid)});
	//console.log(del_result);
}


async function getDocuments(col) {
	let docs = await api.collection(col).find({}).toArray();
	return docs
}


async function AuthenticateUser(creds) {
	let col = api.collection('users');
	
	let u = utils.decodeBase64(creds['username']);
	let p = utils.decodeBase64(creds['password']);
	
	let find = {
		$or: [
			{alias: u},
			{email: u}
		]
	}
	
	try {
		let user = await col.findOne(find);
		
		if(user !== null) {
			let vp = await utils.bcryptValidatePassword(p, user['password']);
			
			switch(vp) {
				case true:
					user['password'] = 'F00';
					let access_token = await utils.generateJwt(user, 'ACCESS_TOKEN');
					let refresh_token = await utils.generateJwt(user, 'REFRESH_TOKEN');
					
					//Life Cycle Id { uuid, iv, key }
					let lcid = await utils.generateLifeCycleId();
					api.collection('LCIDs').insertOne(lcid);
					
					let encrypted_access_token = await utils.encryptData(access_token, lcid.iv, lcid.key);
					let encrypted_refresh_token = await utils.encryptData(refresh_token, lcid.iv, lcid.key);
					
					return { lcid: lcid.lcid, access_token: encrypted_access_token, refresh_token: encrypted_refresh_token, user: user }
					break;
				case false:
				default:
					return false;
					break; //wont get here
			}
		}else {
			utils.logData(`Error: @Mongo:AuthenticateUser, User Not Found.`);
			return false
		}
		
	}catch(error) {
		console.log(`Error: @Mongo:AuthenticateUser, Something went horribly wrong: `, eval(error));
		return false
	}
	
}

async function storeCSRFSession(wsid, csrf_object) {
	let csrf_session_store_result = await insertOne('sessions', {wsid, ...csrf_object});
	//console.log(csrf_session_store_result);
}

async function gcLCIDs() {
	let res = await api.collection('LCIDs').deleteMany({ 'exp': {$lt: new Date().getTime() }});
	if(res.deleteCount >= 1) { console.log(`Removed ${res.deletedCount} stale LCID(s).`); }
}



/* Websocket Specific Functions */
async function sendUsers(ws) {
	let col = api.collection('users');
	let users = await col.find({}, {projection: {password: 0}}).toArray();
	
	ws.send(JSON.stringify(utils.payload('users', users)));
}

async function createUser(new_user_object, ws) {
	let col = api.collection('users');
	let find = {
		$or: [
			{alias: new_user_object.alias},
			{email: new_user_object.email}
		]
	}
	
	col.findOne(find, async function(err, res) {
		if(!err && res !== null) {
			ws.send(JSON.stringify(utils.payload('create-user-failed', 'Username or Email already in use.')));
		}else if (!err && res === null) {
			new_user_object['password'] = await utils.bcryptGeneratePassword(new_user_object['password']);
			
			let nd = new Date().toISOString();
			new_user_object['created'] = nd;
			new_user_object['last_login'] = 'Never';
			
			col.insertOne(new_user_object, async function(err, res) {
				if(err) {
					ws.send(JSON.stringify(utils.payload('create-user-failed', 'New User Insert Failed.')));
				}else if(!err && res) {	
					
					let users = await col.find({}, { projection:{ password: 0 }}).toArray();
					ws.send(JSON.stringify(utils.payload('users', users)));
				}
			});
		}
		
		if(err) {
			console.log('Error@Mongo.CreaeteUser ', err);
			ws.send(JSON.stringify(utils.payload('create-user-failed', 'Something went horribly wrong!')));
		}
	});	
}

async function updateUser(uid,update_values,ws) {
	let col = api.collection('users');
	
	let update_result = await col.updateOne({_id: ObjectId(uid)}, {'$set': update_values});
	if(update_result.modifiedCount === 1) {
		let users = await col.find({}, {projection: {password: 0}}).toArray();
		ws.send(JSON.stringify(utils.payload('users', users)));		
	}
}




async function sendClients(ws) {
	let col = api.collection('clients');
	let clients = await col.find({}).toArray();
	//let clients = await col.find({}, {projection: {secret: 0}}).toArray(); //to omit secret it you want...

	
	ws.send(JSON.stringify(utils.payload('clients', clients)));
}


//https://stackoverflow.com/questions/8855687/secure-random-token-in-node-js <-- for secret generation
async function createClient(new_client, ws) {
	// could generate client_id using something like hat npm package but
	// we will use mongo id
	
	
	let client_secret = utils.randomStringAsBase64Url(64);
	new_client['secret'] = client_secret;
	
	let new_client_result = await insertOne('clients', new_client);
	//console.log(new_client_result);
	
	
	if(new_client_result) { 
		sendClients(ws);
	} else {
		ws.send(JSON.stringify(utils.payload('create-client-failed', "New Client Creation Failed.")));
	}
}


async function updateClient(cid,update_values,ws) {
	let col = api.collection('clients');
	
	let update_result = await col.updateOne({_id: ObjectId(cid)}, {'$set': update_values});
	if(update_result.modifiedCount === 1) {
		let clients = await col.find({}, {projection: {password: 0}}).toArray();
		ws.send(JSON.stringify(utils.payload('clients', clients)));		
	}
}

/* Cleanup Functions for OAuth */
async function gcClientLCIDs() {
	let res = await api.collection('CLIENT_LCIDs').deleteMany({ 'exp': {$lt: new Date().getTime() }});
	if(res.deleteCount >= 1) { console.log(`Removed ${res.deletedCount} stale CLIENT_LCID(s).`); }
}




module.exports = {
	insertOne,
	findOne,
	updateOne,
	deleteOneByKV,
	deleteOneByOID,
	
	/* Specific Functions */
	AuthenticateUser,
	storeCSRFSession,
	
	gcLCIDs,
	
	/* Websocket Specific Functions */
	sendUsers,
	createUser,
	updateUser,
	
	sendClients,
	createClient,
	updateClient,
	
	gcClientLCIDs,
}



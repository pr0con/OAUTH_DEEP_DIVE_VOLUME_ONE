const utils = require('./utilz.js');
const Mongo = require('./mongo.js');

const uWS = require('uWebSockets.js');

/* The Mongo Wrapper */ 
const mongo = require('mongodb');
const ObjectId = require('mongodb').ObjectID;

const bcrypt = require('bcrypt');
const { v1: uuidv1 } = require('uuid');


mongo.MongoClient.connect(utils.system_configuration['databases']['mongo']['url'], { useUnifiedTopology: true, useNewUrlParser: true}, async function(err,db) {
	if(!err) {
		let api = db.db('api');
		utils.logData("Wrapping Mongo Connection : OK");
		
		const app = uWS.SSLApp({
			cert_file_name: utils['system_configuration']['letsencrypt']['public_key_path'],
			key_file_name: utils['system_configuration']['letsencrypt']['private_key_path']
		}).ws('/ws', {
			/* options */
			compression: uWS.SHARED_COMPRESSOR,
			maxPayloadLength: 16 * 1024 * 1024,
			idleTimeout: 0,
			
		
			upgrade: (res, req, context) => {
				utils.logData('An Http connection wants to become a WebSocket, URL: ' + req.getUrl() + '!');
				
				const upgradeAborted = { aborted: false }
				
				res.onAborted(() => {
					utils.logData('Abort Handler Fired...');
					upgradeAborted.aborted = true;
				});
				
				if (req.getHeader('origin') === "https://void.pr0con.com") {
					res.upgrade({url: req.getUrl() },
						req.getHeader('sec-websocket-key'),
						req.getHeader('sec-websocket-protocol'),
						req.getHeader('sec-websocket-extensions'),
						context
					);
				}else {
					utils.logData('Killed foreign Address Request for upgrade.');
					res.close();
				}
			},
			open: async (ws) => {
				utils.logData('A WebScoket connected with URL: '+ ws.url);
				utils.logData('A WebSocket connected via address: ' + utils.ArrayBufferToString(ws.getRemoteAddressAsText()) + '!');
			
				ws.id = "ws-"+uuidv1();
				ws.subscribe('global_messages');
				
				/*
					Generate Websocket Session Data - CSRFToken
				*/
				
				let csrf_object = await utils.generateCSRFToken();
				let csrf_sesion_store_result = await Mongo.storeCSRFSession(ws.id, csrf_object);
				
				utils.logData('Sending Websocket Id & CSRFToken');
				ws.send(JSON.stringify(utils.payload('client-websocket-id', ws.id)));
				ws.send(JSON.stringify(utils.payload('client-websocket-csrf-token', csrf_object['csrf_token'])));
			},
			message: async (ws, message) => {
				let tjo = JSON.parse(utils.ArrayBufferToString(message));
				
				/* 
					GET THE CSRFToken Session Data Document by wsid AND the token provided in messsage
					Session must be IDENTIFIED BY BOTH wsid and csrf_token in the message
					
					Next send the csrf_token from the message to verification (not the found doc), and the
					secret from found session to verification to validate.
				*/
				
				let CSRFTokenSessionObject = await Mongo.findOne('sessions', {'wsid': ws.id, 'csrf_token': tjo['csrf']});		
				if(CSRFTokenSessionObject !== null && 'csrf_secret' in CSRFTokenSessionObject && (await utils.verifyCSRFToken(tjo['csrf'], CSRFTokenSessionObject['csrf_secret']))) {
					//Check for secure message and validate			
					
					let secure_message = false;
					if(tjo['jwt'] !== null && 'access_token' in tjo['jwt'] && 'lcid' in tjo['jwt']) {
						let lcid_record = await Mongo.findOne('LCIDs', {lcid: tjo['jwt']['lcid']});
						let decrypted_access_token = await utils.decryptData(tjo['jwt']['access_token'], lcid_record.iv.buffer, lcid_record.key.buffer);
						
						//secure message return decrypted token if valid
						secure_message = await utils.verifyAccessToken(decrypted_access_token);
						if (!secure_message || secure_message === false) {
							ws.send(JSON.stringify(utils.payload('kill-credz', null)));
							ws.close();
						}
					}
					
					//secure message @this point contains user info + access_token info...
					if(secure_message && secure_message !== false) {
						switch(tjo['type']) {
							case "request-users":
								Mongo.sendUsers(ws);
								break;
							case "create-user":
								Mongo.createUser(tjo['data'],ws);
								break;
							case "update-user":
								Mongo.updateUser(tjo['data']['uid'], tjo['data']['update_values'],ws);
								break;
							
							case "request-clients":
								Mongo.sendClients(ws);
								break;	
							case "create-client":
								Mongo.createClient(tjo['data'], ws);
								break;
							case "update-client":
								Mongo.updateClient(tjo['data']['cid'], tjo['data']['update_values'],ws);
								break;	
								
							case "kill-user":
							case "kill-client":
								let col = tjo['type'].slice('kill-'.length)+'s';
								Mongo.deleteOneByOID(col, tjo['data']);
								switch(col) {
									case 'users':
										Mongo.sendUsers(ws);
										break;
									case 'clients':
										Mongo.sendClients(ws);
										break;
									default:
										break;
								}
								break;
								
							case "add-user-to-client":
								console.log('hit');
								//add to set only ever add one, if it exists it wont add it again...
								Mongo.updateOne('clients', {'_id': ObjectId(tjo['data']['cid'])}, {$addToSet: {users: ObjectId(tjo['data']['uid']) }}); 
								break;
							case "remove-user-from-client":
								Mongo.updateOne('clients', {'_id': ObjectId(tjo['data']['cid'])}, {$pull: {users: ObjectId(tjo['data']['uid']) }});
								break;
							default:
								break;
						}
					}	
						
				}else {
					ws.send(JSON.stringify(utils.payload('csrf-kill-signal', null)));
					ws.close();
				}
				
			},
			drain: (ws) => {
				utils.logData('WebSocket Back Pressure: ' + ws.getBufferedAmount());
			},
			close: async (ws, code, message) => {
				utils.logData('WebSocket Closed');
				await Mongo.deleteOneByKV('sessions', {'wsid': ws.id});
			}	
		}).listen(1300, async(sock) => {
			(sock) ? utils.logData("Node WS Server Listening : 1300") : utils.logData("Something went horribly wrong!");
		
			let api_collections = await api.listCollections().toArray();
			let obj = api_collections.find(o => o.name === "sessions");
			
			if(obj) await api.collection("sessions").drop();
		});
		
	}else {
		utils.logData("Unable to connect to wrapping mongo instance.");
	}
		
});

process.on('unhandledRejection', (err,promise) => {
	console.log(`Caught Promise Rejection @server.js: ${err.message}`);
});

setInterval(async function() {
	await Mongo.gcLCIDs();
	await Mongo.gcClientLCIDs();
}, 5000); //every 5 seconds








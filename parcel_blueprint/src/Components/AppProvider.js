import React, { useState, useEffect, createContext } from 'react';
import axios from 'axios';


import CSRFTokens from 'csrf';
const csrfTokens = new CSRFTokens();

import { usePath } from 'hookrouter';

//For Difference function
const { inspect } = require('util'); //native
const transform = require('lodash.transform');
const isEqual = require('lodash.isequal');
const isArray = require('lodash.isarray');
const isObject = require('lodash.isobject');

export const AppContext = createContext()
export default function(props) {
	const path = usePath();
	
	const [ route, setRoute ] = useState('dashboard');
	const [ sidebar, setSidebar ] = useState(true); 
	
	/* User Session Data */
	const [ user , setUser ] = useState(null);
	const [ LCID, setLCID ] = useState(null);
	const [ AccessToken, setAccessToken ] = useState(null);
	
	
	/*Websocket Com's */
	const [ rs, setRs ] = useState(0);
	const [ ws, setWs ] = useState(null);
	
	const [ wsId, setWsId ] = useState(null);
	const [ CSRFToken, setCSRFToken ] = useState(null);
	
	
	/* UI Components & State */
	const [ state, setState ] = useState(false);
	const [ loading, setLoading ] = useState(true);
	const [ messages, setMessages ] = useState([]);
	
	
	/* OAuth 2.0 Data */
	const [ users, setUsers ] = useState([]);
	const [ clients, setClients ] = useState([]);

	const [ stateParamsLoaded, setStateParamsLoaded ] = useState(false);
	
	const [ urlParams, setUrlParams ] = useState(new URLSearchParams(document.location.search));
	
	//stored access tokens for individual clients
	const [ clientAccessTokens, setClientAccessTokens ] = useState({});


	const logData = (message) => {
		var d = new Date()
		var time = '[' + d.getHours() + ':' + d.getMinutes() + ':' + d.getSeconds() + ']';
		
		return `${time} ${message}`;
	}
	
	/**
	 * https://davidwells.io/snippets/get-difference-between-two-objects-javascript
	 * Find difference between two objects
	 * @param  {object} origObj - Source object to compare newObj against
	 * @param  {object} newObj  - New object with potential changes
	 * @return {object} differences
	 */
	function difference(origObj, newObj) {
	  function changes(newObj, origObj) {
	    let arrayIndexCounter = 0
	    return transform(newObj, function (result, value, key) {
	      if (!isEqual(value, origObj[key])) {
	        let resultKey = isArray(origObj) ? arrayIndexCounter++ : key
	        result[resultKey] = (isObject(value) && isObject(origObj[key])) ? changes(value, origObj[key]) : value
	      }
	    })
	  }
	  return changes(newObj, origObj)
	}
	
	
	const  encodeClientCredentials = (client_id, client_lcid) => {
		return Buffer.from(encodeURIComponent(client_id)+':'+encodeURIComponent(client_lcid).toString('base64'));
	} 

	
	const request = async (type,data) => {
		let payload = {
			csrf: CSRFToken,
			jwt: {access_token: AccessToken, lcid: LCID},
			type,
			data
		};
		ws.send(JSON.stringify(payload));
	}
	
		
	
	const heartbeat = async (ws) => {
		setTimeout(
			function() {
				//console.log(ws.readyState);
				/*  0 	CONNECTING 	Socket has been created. The connection is not yet open.
					1 	OPEN 	The connection is open and ready to communicate.
					2 	CLOSING 	The connection is in the process of closing.
					3 	CLOSED 	The connection is closed or couldn't be opened.	
				*/
				if (rs !== ws.readyState) { setRs(ws.readyState); }
				(ws.readyState !== 3 && ws !== null) ? heartbeat(ws) : console.log('Closed WebSocket');			
			}
			.bind(this),
			1000
		)
	}
	
	const configureWebsocket = async () => {
		ws.onopen = function(open_event) {
			console.log(open_event);
			ws.onmessage = function(msg_event) {
				console.log(msg_event);
				
				let tjo = JSON.parse(msg_event.data);
				
				switch(tjo['type']) {
					/* Websocket Configuration */
					case "client-websocket-id":
						setWsId(tjo['data']);
						break;
					case "client-websocket-csrf-token":
						setCSRFToken(tjo['data']);
						break;						
					case "kill-credz":	
					case "csrf-kill-signal":
						Logout();
						break;
					
					/* user creation */	
					case "users":
						setUsers(tjo['data']);
						break;

					//add new messsage letting us know we updated clients...
					case "clients":
						setClients(tjo['data']);
						setMessages((msgs) => [ logData('New Client List Received'),...msgs]);
						break;
						
						
					case "create-user-failed":
					case "create-client-failed":
						setMessages((msgs) => [ logData(tjo['data']),...msgs]);
						break;
						
					default:
						break;
				}		
				
			}
			ws.onclose = function(close_event) {
				console.log(close_event);
			}
			ws.onerror = function(error_event) {
				console.log(error_event);
			}
			
		}

	}
	
	useEffect(() => {
		if(AccessToken !== null && CSRFToken === null) {
			if(ws === null) { setWs(new WebSocket('wss://void.pr0con.com:1300/ws'));}
			if(ws !== null && rs === 0) { configureWebsocket(); heartbeat(ws); }
		}
	},[AccessToken, ws, rs]);
	
	useEffect(() => {
		if(AccessToken !== null && CSRFToken !== null) {
			//request('verify-access-token', null); //being done already on every request..
			//add initial requests here...
			
			request('request-users', null);
			request('request-clients', null);
		}
	},[CSRFToken])
	
	
		
	useEffect(() => {
		console.log(path);
	},[path]);
	
	const handleKeyUpEvent = async(key_event) => {
		if(key_event.type == "keyup") {
			switch(key_event.key) {
				case 'Escape':
					setState(!state);
					console.log(state);
					break;
				case 'Shift':
					break;
				case 'Enter':
					break;
				case 'ArrowLeft':
					break;
				case 'ArrowRight':
					break;
				case 'ArrowDown':
					break;
				case 'ArrowUp':
					break;					
			}	
		}	
	}
		
	useEffect(() => {
		window.addEventListener("keyup", handleKeyUpEvent);
		
		//cleanup
		return () => {
			window.removeEventListener("keyup", handleKeyUpEvent);
		}
	},[handleKeyUpEvent]);	
	
	useEffect(() => {
		if(loading === true) {
			let LCID = localStorage.getItem('LCID');
			if(LCID) {
				setLCID(LCID);
				
				let payload = {
					LCID: LCID,
					grant_type: 'refresh_token'
				}
				
				let options = {
					headers: {
						'Content-Type': 'application/json'
					},
					withCredentials: true //Need this to store returned cookie!
				}
					
				axios.post('https://void.pr0con.com:1400/api/auth/refresh_token', payload, options).then((res) => {
					console.log(res);
					switch(res.data.success) {
						case true:
							setUser(res.data.user);
							setAccessToken(res.data.access_token);
							break;
						case false:
							//or Logout();
							localStorage.removeItem('LCID');
							break;
						default:
							break;	
					}
				}, (error) => {
					console.log(error);
				});
			}else {
				//do nothing right now...
			}
		}
		setLoading(false);
	},[]);
	
	
	const Logout = () => {	
		setAccessToken(null);
		(ws !== null) ? ws.close() : '';
		setWs(null);
		setWsId(null);
		setCSRFToken(null);
		setUser(null);
		setLCID(null);
		localStorage.removeItem('LCID');
	}
	
	useEffect(() => { 
		if(rs === 3) {
			setRs(0);
			if(ws !== null) { ws.close(); setWs(null); }
		}
	},[rs]);
	
	
	/* OAuth2.0 Stuff */
	//NSAI is used for new authorization code requests....
	//Previous Application State Param PSAI_ is used for when we come back from a callback url
	useEffect(() => {
		console.log('CL: ',clients.length,'SPL: ',stateParamsLoaded);
		if(clients.length > 0 && stateParamsLoaded === false) {
			clients.forEach((c,i) => {
				//get previous state parameters if they exists
				let psai = 'PSAI_'+c._id; //previous state param local storage id.
				let psai_value = localStorage.getItem('NSAI_'+c._id);
				
				let secret = csrfTokens.secretSync()
				let token = csrfTokens.create(secret);
				
				if(psai_value !== null) {
					//generate new psai
					localStorage.setItem(psai, psai_value);	
				}
							
				//generate new state parameters for each client
				secret = csrfTokens.secretSync()
				token = csrfTokens.create(secret);
				
				let nsai = 'NSAI_'+c._id; //new state param local stroage id.
				localStorage.setItem(nsai, token);
			});
			console.log(logData('State Params Loaded.'));
			setStateParamsLoaded(true);
		}
	},[clients]);
	

		
	return(
		<AppContext.Provider value={{
			/* App Routing */
			path,
			sidebar,
			setSidebar,
			
			/* Util Functions */
			difference,
			encodeClientCredentials,
			
			/* User Session Data */
			user, 
			setUser,
			LCID,
			setLCID,
			AccessToken,
			setAccessToken,
			
			/* WebSocket Stuff*/
			rs,
			wsId,
			CSRFToken,
			request,
			
			/* Application State and Functions */
			state,
			Logout,
			logData,
			messages, 
			setMessages,
			
			/* OAuth 2.0 Data */
			users,
			clients,
			stateParamsLoaded,
			
			urlParams,
			clientAccessTokens, 
			setClientAccessTokens,
		}}>
			{props.children}
		</AppContext.Provider>
	)
}
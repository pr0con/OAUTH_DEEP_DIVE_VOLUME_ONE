import React, { useState, useEffect, useContext } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import qs from 'querystring';

import { AppContext } from './AppProvider.js';

const StyledCubeLeft = styled.div`
	transform: rotateY(-90deg) translateZ(1000px);
	padding: 1rem;
	
	display: flex;
	flex-direction: column;
	
	padding: 1rem;
	#callback-split-screen {
		
		display: grid;
		grid-template-columns: 50% 50%;
		
		#client-request-callback-information {
			display: flex;
			flex-direction: column;
			
			#client-request-callback-information-form {
				display: flex;
				flex-direction: column;	
			}	
		}
	
		#requested-resources-and-debugger {
			display: grid;
			grid-template-row: 50% 50%;	
			font-size: 1.8rem;
		}	
	}
`;

export function CubeLeft() {
	const [ reqObject, setReqObject ] = useState({});
	const [ allowManipulate, setAllowManipulate ] = useState(false);
	
	const { urlParams, encodeClientCredentials, stateParamsLoaded, clientAccessTokens, setClientAccessTokens, logData  } = useContext(AppContext);
	
	const [ invalidState, setInvalidState ] = useState(false);
	
	/*
		the refresh token would normally be stored as cookie only
		but we want to test OAuths 'refresh_token' response
	*/
	const [ AccessToken, setAccessToken ] = useState('');
	const [ RefreshToken, setRefreshToken ] = useState(''); 
	
	
	const [ protectedResource, setProtectedResource ] = useState('');
	const [ debuggerMessages, setDebuggerMessages ] = useState([]);
	
	useEffect(() => {
		if(urlParams.has("client_id") && urlParams.has('code') && urlParams.has('state') && urlParams.has('lcid')) {
			let redirect_uri = location.protocol + '//' + location.host + location.pathname;
			setReqObject({
				client_id: urlParams.get("client_id"),
				code: urlParams.get("code"),
				state: urlParams.get("state"),
				lcid: urlParams.get("lcid"),
				redirect_uri: redirect_uri,
			})	 	
		}
	},[]);

 	const requestTokens = () => {	
		let previous_state_param = localStorage.getItem('PSAI_'+urlParams.get("client_id"));
	 	console.log(previous_state_param + " ?= " + urlParams.get("state"));
	 	
		if(previous_state_param === urlParams.get("state") || allowManipulate) {
			//we have enough to make a request for our access_token and refresh_token
		 	
			//NOTE: Client ID & LCID(as secret) encoded in encodeClientCredentials --> client_id:lcid 
			let options = {
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					'Authorization': 'Basic ' + encodeClientCredentials(reqObject.client_id, reqObject.lcid)//replacing secret with LCID
				},
				withCredentials: true //Need this to get cookie returned...
			}
			
			//could include client_id in payload...
			let payload = {
				lcid: reqObject.lcid,
				redirect_uri: reqObject.redirect_uri,
				grant_type: "authorization_code",
				code: reqObject.code, //encrypted code
				param_key: reqObject.state //custum aditonal idea to decrypt code
			}
			
			axios.post('https://void.pr0con.com:1500/token', qs.stringify(payload), options).then((res) => {
				console.log(res);
				if('lcid' in res.data) localStorage.setItem(reqObject.client_id+'_lcid', res.data.lcid);
				if('access_token' in res.data) setAccessToken(res.data.access_token);
				if('refresh_token' in res.data) setRefreshToken(res.data.refresh_token);
			},(error) => {
				if('success' in error.response.data && error.response.data.success === false) {
					setDebuggerMessages((dmsgs) =>  ([logData(error.response.data.message), ...dmsgs]));
				}
			});
		}else {
			setInvalidState(true);
		}	 	
 	}

	useEffect(() => {
		if(Object.keys(reqObject).length === 5 && stateParamsLoaded) {
			requestTokens();
		}
	},[stateParamsLoaded, reqObject]);
 	
 	
 	const updateClientReqObject = (key,value) => {
		if(allowManipulate === true) {
			setReqObject((ro) => ({ ...ro, [key]:value }));
		}
 	}
 	

 	 	
 	 	
 	/*
	 	Set Access Token to Client in Current State &&
		Automatically request resource with Access Token here
		
		- ValidateAccesToken simulates resource request
	*/
	const ValidateAccessToken = () => {
		if(AccessToken !== '') {
			let options = {
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					'Authorization': 'Bearer '+AccessToken
				}
			}

			let payload = {
				lcid: reqObject.lcid
			}
			
			//dont need with credentials here not using cookie...
			//if access token exists we should have an LCID in state
			axios.post('https://void.pr0con.com:1600/validate_access_token', qs.stringify(payload), options).then((res) => {
				if('success' in res.data && res.data.success === true) {
					setProtectedResource(res.data);
				}
			},(error) => {
				if('success' in error.response.data && error.response.data.success === false) {
					setDebuggerMessages((dmsgs) =>  ([logData(error.response.data.message),...dmsgs]));
				}
			});
		}	
	}
	
 	useEffect(() => {
	 	if(AccessToken !== '') {
			setClientAccessTokens((ats) => ({ [reqObject.client_id]: AccessToken ,...ats}));
			ValidateAccessToken();
		}
 	},[AccessToken]);
 	
 	
 	
 	/*
 		Request New Tokens Using grant_type: "refresh_token",
 		this is the call you would make if the access token becomes invalid during session
 		or page is refreshed....
 		
 		if using cookie need withCredentials: true
 		
 		use cookie later on if this content is no longer available
 	*/
 	const requestNewTokens = () => {
	 	let options = {
		 	headers: {
			 	'Content-Type': 'application/x-www-form-urlencoded',
			 	'Authorization': 'Basic '+ encodeClientCredentials(reqObject.client_id, reqObject.lcid) //using lcid to decrypt refresh token
		 	},
		 	withCredentials: true //Need this to get new cookie returned...
	 	}
	 	
	 	let payload = {
		 	grant_type: 'refresh_token',
		 	refresh_token: RefreshToken //or refresh token state variable...
	 	}
	 	
	 	axios.post('https://void.pr0con.com:1500/refresh_token_via_grant_type', qs.stringify(payload), options).then((res) => {
		 	//console.log(res)
		 	if('access_token' in res.data) setAccessToken(res.data.access_token);
		 	if('refresh_token' in res.data) setRefreshToken(res.data.refresh_token);		 	
		},(error) => {
			if('success' in error.response.data && error.response.data.success === false) {
				setDebuggerMessages((dmsgs) =>  ([logData(error.response.data.message),...dmsgs]));
			}
		});
 	}
 		
	return(
		<StyledCubeLeft className="cube-face">
			<span className="cube-face-title">Callback</span>
			<div id="callback-split-screen" className="flex-filler">
				{ Object.keys(reqObject).length > 0 ?
					<div id="client-request-callback-information" className="form">
						<span className="form-title">Client Request Callback Information</span>
						<div id="client-request-callback-information-form">
							<input type="text" placeholder="Client Id" value={reqObject.client_id} onChange={(e) => updateClientReqObject('client_id', e.target.value)} />
							<input type="text" placeholder="Redirect URI" value={reqObject.redirect_uri} onChange={(e) => updateClientReqObject('redirect_uri', e.target.value)}/>
							<input type="text" placeholder="Code" value={reqObject.code} onChange={(e) => updateClientReqObject('code', e.target.value)}/>
							<input type="text" className={invalidState ? `invalid`:''} placeholder="State" value={reqObject.state} onChange={(e) => updateClientReqObject('state', e.target.value)}/>
							<input type="text" placeholder="LCID" value={reqObject.lcid} onChange={(e) => updateClientReqObject('lcid', e.target.value)}/>
							<div className="form-italic-information">
								<div className="form-information-label">Access Token</div>
								{ AccessToken }
							</div>
							<div className="form-italic-information">
								<div className="form-information-label">Refresh Token</div>
								{ RefreshToken }
							</div>							
							<div className="form-actions">
								<span className="form-action-button" onClick={(e) => requestNewTokens()}>Request New Tokens</span>	
								<span className="form-action-button mr-5" onClick={(e) => requestTokens()}>Request Tokens</span>	
								<div className="flex-filler"></div>
								<span className="form-action-button" onClick={(e) => setAllowManipulate(!allowManipulate)}>Allow Manipulate</span>
							</div>
						</div>
					</div>
					:
					<div>Loading or faulty return on callback.</div>	
				}
				<div id="requested-resources-and-debugger" className="form">
					<div id="requested-resources">
						{JSON.stringify(protectedResource)}
					</div>
					<div id="callback-and-token-debugger">
						{	debuggerMessages.length > 0 && debuggerMessages.map((msg, i) => (
							<div className="message" key={`message-${i}`}>{msg}</div>
						))}						
					</div>
				</div>
			</div>
		</StyledCubeLeft>	
	)
}
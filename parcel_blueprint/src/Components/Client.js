import React, { useState, useEffect, useContext } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import qs from 'querystring';

import { AppContext } from './AppProvider.js';

const StyledClient = styled.div`
	
`;

export function Client({client}) {
	const [ loading, setLoading ] = useState(true);
	const [ updatedClient, setUpdatedClient ] = useState({});
	const [ authorizeLink, setAuthorizeLink ] = useState(null);
	
	const { difference, request,  stateParamsLoaded, clientAccessTokens } = useContext(AppContext);
	
	const [ clientAccessToken, setClientAccessToken ] = useState('');
	const [ protectedResource, setProtectedResource ] = useState('');
	
	useEffect(() => {
		let tmp_client_obj = {};
		for (const [key, value] of Object.entries(client)) {
			(key !== '_id') ? tmp_client_obj[key] = value : '';
		}
		setUpdatedClient(tmp_client_obj);
		setLoading(false);		
	},[]);
	
	
	const updateClientObject = (key,value) => {
		setUpdatedClient((co) => ({ ...co, [key]:value }));
	}	
	
	//Client Authorize URL not updating... 
	const handleUpdateClient = () => {
		let updated_client_values = difference(client, updatedClient);
		if(Object.keys(updated_client_values).length > 0) {
			console.log('updating');
			request('update-client',{cid: client._id, update_values: updated_client_values });
		}
	}
	
	//generate authorize link...
	//authorization_server on 1500!
	useEffect(() => {
		if(stateParamsLoaded) {
			let state_param = localStorage.getItem('NSAI_'+client._id);
			let authorize_link = `https://void.pr0con.com:1500/authorize?client_id=${client._id}&response_type=code&redirect_uri=${client.callback}&scope=${client.scope}&state=${state_param}`;
			setAuthorizeLink(authorize_link);
		}
	},[stateParamsLoaded]);
	
	useEffect(() => {
		if([client._id] in clientAccessTokens) setClientAccessToken(clientAccessTokens[client._id]);
	},[clientAccessTokens])
	
	
	//will simulate fetching resourcess with access token
	const ValidateAccessToken = () => {
		if(clientAccessToken !== '') {
			let options = {
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					'Authorization': 'Bearer '+clientAccessToken
				}
			}

			let payload = {
				lcid: localStorage.getItem(client._id+'_lcid')
			}
			
			//dont need with credentials here not using cookie...
			//if access token exists we should have an LCID in state
			axios.post('https://void.pr0con.com:1600/validate_access_token', qs.stringify(payload), options).then((res) => {
				if('success' in res.data && res.data.success === true) {
					setProtectedResource(res.data);
					setATValid(true);
				}
			},(error) => {
				if('success' in error.response.data && error.response.data.success === false) {
					setProtectedResource(error.response.data);
					setATValid(false);
				}
			});
		}	
	}
	
	return(
		<StyledClient className="form">
			
			<div className="form-title">
				<span>{ client._id}</span>
				<div className="flex-filler"></div>
				<svg className="kill-document" onClick={(e) => request('kill-client',client._id)} aria-hidden="true" focusable="false" data-prefix="far" data-icon="skull" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M344 200c-30.9 0-56 25.1-56 56s25.1 56 56 56 56-25.1 56-56-25.1-56-56-56zm-176 0c-30.9 0-56 25.1-56 56s25.1 56 56 56 56-25.1 56-56-25.1-56-56-56zM256 0C114.6 0 0 100.3 0 224c0 70.1 36.9 132.6 94.5 173.7 9.7 6.9 15.2 18.1 13.5 29.9l-6.8 47.9c-2.7 19.3 12.2 36.5 31.7 36.5h246.3c19.5 0 34.4-17.2 31.7-36.5l-6.8-47.9c-1.7-11.7 3.8-23 13.5-29.9C475.1 356.6 512 294.1 512 224 512 100.3 397.4 0 256 0zm133.7 358.6c-24.6 17.5-37.3 46.5-33.2 75.7l4.2 29.7H320v-40c0-4.4-3.6-8-8-8h-16c-4.4 0-8 3.6-8 8v40h-64v-40c0-4.4-3.6-8-8-8h-16c-4.4 0-8 3.6-8 8v40h-40.7l4.2-29.7c4.1-29.2-8.6-58.2-33.2-75.7C75.1 324.9 48 275.9 48 224c0-97 93.3-176 208-176s208 79 208 176c0 51.9-27.1 100.9-74.3 134.6z"></path></svg>				
			</div>			
			{ loading && <div className="form-loading">Loading...</div> }
			{ !loading &&
				<>
					<input type="text" placeholder="Client Title" value={updatedClient.title} onChange={(e) => updateClientObject('title', e.target.value)} />
					<input type="text" placeholder="Desciption" value={updatedClient.description} onChange={(e) => updateClientObject('description', e.target.value)}/>					
					<input type="text" placeholder="Callback" value={updatedClient.callback} onChange={(e) => updateClientObject('callback', e.target.value)}/>
					<input type="text" placeholder="Scope" value={updatedClient.scope} onChange={(e) => updateClientObject('scope', e.target.value)}/>					
					
					<div className="form-italic-information">
						<div className="form-information-label">Secret</div>
						{ client.secret }				
					</div>					
					<div className="form-actions">				
						<span className="form-action-button" onClick={(e) => handleUpdateClient()}>Update Client</span>
						<span className="flex-filler"></span>
						{  (stateParamsLoaded && authorizeLink !== null ) && 
							<a className="form-action-button" href={authorizeLink}>Authorize Client</a>
						}
					</div>
					<div className="form-italic-information">
						<div className="form-information-label">Access Token</div>	
						<div className="form-information-data">{ clientAccessToken }</div>			
					</div>	
					<div className="form-actions">	
						<span className="form-action-button" onClick={(e) => ValidateAccessToken()}>Validate Access Token</span>
					</div>
					<div className="form-italic-information">
						<div className="form-information-label">Protected Resource Call</div>	
						<div className="form-information-data fs-16">{JSON.stringify(protectedResource)}</div>			
					</div>															
				</>
			}
		</StyledClient>
	)
}
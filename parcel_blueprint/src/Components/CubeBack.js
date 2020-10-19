import React, { useState, useEffect, useContext } from 'react';
import styled from 'styled-components';
import qs from 'querystring';
import axios from 'axios';

import { AppContext } from './AppProvider.js';

const StyledCubeBack = styled.div`
	transform: translateZ(-1000px) rotateY(-180deg);

	display: flex;
	flex-direction: column;

	#clients {
		display: grid;
		grid-template-columns: 45rem 45rem;
		grid-gap: 2rem;
		
		padding-top: 2rem;
		justify-content: center;
	}
	
	#client-management-forms {
		display: flex;
		flex-direction: row-reverse;
		padding: 1rem;
		
		#create-client-form {
			min-width: 32rem;	
		}			
	}	
`;

import { Client } from './Client.js';

//client are apps acting on behalf of the user...
export function CubeBack() {
	const [title, setTitle] = useState('');
	const [description, setDescription] = useState('');
	const [callback,setCallback] = useState('');
	const [scope, setScope] = useState(''); //space seperated values....
	
	//for adding users / removing users to client...
	const [ CID, setCID ] = useState('');
	const [ UID, setUID ] = useState('');
	
	const { AccessToken, request, clients, encodeClientCredentials, setClientAccessTokens, logData, setMessages  } = useContext(AppContext);

	
	
	const handleCreateClient = () => {
		if(![title,description,callback,scope].includes("")) {
			let create_client_payload = {
				title,
				description,
				callback,
				scope
			}
			request('create-client', create_client_payload);
		}else {
			//could generate message on sidebar here...
			console.log("All values required.");
		}
	}
	
	const clearForm = () => {
		setTitle('');
		setDescription('');
		setCallback('');
		setScope('');	
	}
	
	
	/* 
		Loop through each client and Validate Previous Access
		Or like our user automatically restore session with
		new tokens... keep same Life Cycle ID...
		
		LCID should expire sooner than new refresh token
		make all access tokena and refresh tokens asscociated with 
		it only valid through life cycle...
		
		You could update the exp in lcid record to match new Refresh Token exp...
	*/
	const refreshClientAccessViaCookie = (client_id, client_lcid) => {
		console.log('Requesting Client Access Refresh via Cookie');
	 	console.log('client_lcid', client_lcid);
	 	
	 	let options = {
		 	headers: {
			 	'Content-Type': 'application/x-www-form-urlencoded',
			 	'Authorization': 'Basic '+ encodeClientCredentials(client_id,client_lcid) //using lcid to decrypt refresh token
		 	},
		 	withCredentials: true //Need this to get new cookie returned...
	 	}
	 
	 	//refresh token in cookie...	
	 	let payload = { 
		 	grant_type: 'refresh_token',
	 	}
	 	
	 	axios.post('https://void.pr0con.com:1500/refresh_token_via_cookie', qs.stringify(payload), options).then((res) => {
		 	console.log(res);
		 	if('access_token' in res.data) {
			 	setClientAccessTokens((ats) => ({ [client_id]: res.data.access_token ,...ats}))
		 	}
			//refresh token will be in new cookie		 	
		},(error) => {
			console.log(error);
			if('response' in error && 'data' in error.response && error.response.data.success === false) {
				setMessages((msgs) => [ logData(`${error.response.data.message}`),...msgs]);	
			}
		});		
	}
	
	useEffect(() => {
		if(clients.length > 0) {
			clients.forEach((c,i) => {
				let stored_client_lcid = localStorage.getItem(c._id+'_lcid');	
				if(stored_client_lcid) {
					refreshClientAccessViaCookie(c._id, stored_client_lcid);
				}
			});			
		}
	},[clients])	

	const handleAddRemoveUserFromClient = (action) => {
		if(![CID,UID].includes('')) {
			switch(action) {
				case "add":
					request('add-user-to-client', {cid: CID, uid: UID });
					break;
				case "remove":
					request('remove-user-from-client', {cid: CID, uid: UID });
					break;
				default:
					break;
			}
			console.log(CID,UID);
		}
	}
	
	return(
		<StyledCubeBack className="cube-face">
			<span className="cube-face-title">Client Management</span>
			<div id="clients" className="flex-filler">
				{ clients.length > 0 && clients.map((client, i) => (
					<div className="client" key={`client-${client._id}`}>
						<Client client={client} />
					</div>
				))}			
			</div>
			<div id="client-management-forms">
				{AccessToken !== null &&
					<>
						<div id="create-client-form" className="form">
							<span className="form-title">Create Client</span>
							<input type="text" placeholder="Client Title" value={title} onChange={(e) => setTitle(e.target.value)}/>
							<input type="text" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)}/>
							<input type="text" placeholder="Callback" value={callback} onChange={(e) => setCallback(e.target.value)}/>
							<input type="text" placeholder="Scope" value={scope} onChange={(e) => setScope(e.target.value)}/>
							<div className="form-actions">
								<span className="form-action-button" onClick={(e) => handleCreateClient()}>Create Client</span>
							</div>						
						</div>
						<div id="add-remove-users" className="form">
							<input type="text" placeholder="Client Id" value={CID} onChange={(e) => setCID(e.target.value)}/>
							<input type="text" placeholder="User Id" value={UID} onChange={(e) => setUID(e.target.value)}/>						
							<div className="form-actions">
								<span className="form-action-button" onClick={(e) => handleAddRemoveUserFromClient('add')}>Add User</span>
								<div className="flex-filler"></div>
								<span className="form-action-button" onClick={(e) => handleAddRemoveUserFromClient('remove')}>Remove User</span>
							</div>					
						</div>						
					</>
				}					
			</div>
		</StyledCubeBack>	
	)
}
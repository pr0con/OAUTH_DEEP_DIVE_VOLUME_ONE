import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import styled from 'styled-components';
import axios from 'axios';

import AppProvider from './AppProvider.js';
import { AppContext } from './AppProvider.js';

const StyledApp = styled.div`
	position: relative;
	
	top:0px;
	left: 0px;
	
	width: 100vw;
	height: 100vh;
	
	#auth-box {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		
		border: 1px solid #000;
		
		display: flex;
		flex-direction: column;
		
		font-size: 1.4rem;
		padding: 1rem;
		
		#auth-box-info {
			display: grid;
			grid-template-columns: 10rem 1fr;	
			
			.right-align { text-align: right; }
			padding: 2rem 0 2rem 0;
		}
		
		input {
			background: transparent;
			border: 1px solid #000;
			
			min-height: 2.5rem;
			margin-top: .5rem;
			
			text-indent: 1rem;
			font-size: 1.4rem;
		}
		
		#auth-box-submit-button {
			border: 1px solid #000;
			padding: 1rem;
			display: flex;
			justify-content: center;
			align-items: center;	
			
			max-height: 2.5rem;
			margin-top: .5rem;
			
			&:hover { cursor: pointer; background: #000; color: #fff; }
		}
	}
`;

function App() {
	const [ username, setUsername ] = useState('');
	const [ password, setPassword ] = useState('');
	
	const urlParams = new URLSearchParams(window.location.search);
	
	const [ sendTo, setSendTo ] = useState('');
	
	const authorizeApp = () => {
		let options = {
			headers: {
				'Content-Type': 'application/json'
			}
		}
		let payload = {
			username: username,
			password: password,
			
			client_id: urlParams.get('client_id'),
			response_type: urlParams.get('response_type'),
			redirect_uri: urlParams.get('redirect_uri'),
			state: urlParams.get('state'),
			scope: urlParams.get('scope')
		}
		axios.post("https://void.pr0con.com:1500/authorize_app", payload, options).then((res) => {
			if('success' in res.data && 'send_to' in res.data && res.data.success === true) {
				setSendTo(res.data.send_to);
			}
		}, (error) => {
			console.log(error);
		});
	}
	
	useEffect(() => {
		if(sendTo !== '') {
			window.location.href = sendTo;
		}
	},[sendTo]);
	
	return(
		<AppProvider>
			<AppContext.Consumer>
				{({  }) => (		
					<StyledApp>
						<div id="auth-box">
							<span id="auth-box-title">Allow Client App to Operate on Your Behalf</span>
							<div id="auth-box-info">
								<span>Client Id:</span><span className="right-align">{urlParams.get('client_id')}</span>
								<span>Access Req:</span><span className="right-align">{urlParams.get('scope')}</span>
							</div>
							<input type="text" value={username} onChange={(e) => setUsername(e.target.value)} />
							<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
							<div id="auth-box-submit-button" onClick={(e) => authorizeApp()}>Authenticate App</div>
						</div>
					</StyledApp>
				)}
			</AppContext.Consumer>
		</AppProvider>				
	)
}


if(document.querySelector('#react_root')) {
	ReactDOM.render(<App />, document.querySelector('#react_root'));
}

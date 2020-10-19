import React, { useState, useEffect, useContext } from 'react';
import styled from 'styled-components';

import axios from 'axios';
import { AppContext } from './AppProvider.js';

const StyledLogin = styled.div`
	position: absolute;
	
	top: 50%;
	left: 50%;
	
	width: 30rem;
	min-height: 11.8rem;
	
	transform: translate(-50%,-50%);
	
	
		
	display: flex;
	flex-direction: column;
		
	
	#login-front,
	#login-back {		
		position: absolute;
		
		top: 0px;
		left: 0px;
		
		display: flex;
		flex-direction: column;			
		
		border: 1px solid #ccc;
		background: rgba(0,0,0,.8);		
		
		width: 30rem;
		height: auto;		
		
		padding: 1rem;
		
		.login-title {
			color: #ccc;
		}
		
		.login-actions {
			display: flex;
			flex-direction: row-reverse;
			
			span:hover { color: #acf9fb; cursor: pointer; }
		}	
		
		input {
			position: relative;
			margin-top: .5rem;
			
			background: transparent;
			border: 1px solid #ccc;
			color: #ccc;
			font-size: 1.8rem;
			font-style: italic;	
			font-weight: 500;
			text-indent: 1rem;
		}
		
		backface-visibility: hidden;
	}

	#login-back {
		transform: rotateY(180deg);	
	}

	transition: transform 1s;
	transform-origin: center center;
	transform-style: preserve-3d;	
	
	&.user-logged-in {
		min-height: 6rem;
		transform: translateX(-50%) rotateY(-180deg);
	}
`;

export function Login() {
	const [ username, setUsername ] = useState('');
	const [ password, setPassword ] = useState('');

	const { rs, user, setUser, setLCID, AccessToken, setAccessToken, loading, Logout } = useContext(AppContext);	

	const handleLogin = () => {
		if(username !== "" && password !== "") {
			let payload = {
				username: btoa(username),
				password: btoa(password)
			}
			
			let options = {
				headers: {
					'Content-Type': 'application/json'
				},
				withCredentials: true //Need this to store returned cookie!
			}
				
			axios.post('https://void.pr0con.com:1400/api/auth/login', payload, options).then((res) => {
				console.log(res);
				localStorage.setItem('LCID', res.data.lcid);
				
				setUser(res.data.user);
				setLCID(res.data.lcid);
				setAccessToken(res.data.access_token);
				
			}, (error) => {
				console.log(error.response.data);
			});
		}
	}

	//Implement Reconnect Button...
	return(
		<StyledLogin className={(user !== null && AccessToken !== null) ? 'user-logged-in' : ''}>
			{ (loading !== true && user === null && AccessToken === null) &&
				<div id="login-front">
					<span className="login-title">{loading ? 'Loading...' : 'Please Login...'}</span>
		
					<input type="text" value={username} onChange={(e) => setUsername(e.target.value)}/>
					<input type="password" value={password} onChange={(e) => setPassword(e.target.value)}/>
					
					<div className="login-actions">
						<span onClick={(e) => handleLogin()}>Login</span>
					</div>			
				</div>
			}
			{ (user !== null && AccessToken !== null) && 
				<div id="login-back">
					<span className="login-title">{ `${user.firstname} ${user.lastname}`}</span>
					
					<div className="login-actions">
						{ rs === 0 && <span>Reconnect</span> }
						<span onClick={(e) => Logout()} className="mr-5">Logout</span>
					</div>
				</div>
			}
		</StyledLogin>	
	)
}


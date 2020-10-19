import React, { useState, useEffect, useContext } from 'react';
import styled from 'styled-components';

import { AppContext } from './AppProvider.js';

const StyledCubeRight = styled.div`
	transform: rotateY(90deg) translateZ(1000px);
	
	display: flex;
	flex-direction: column;
	
	
	#users {
		display: grid;
		grid-template-columns: 30rem 30rem 30rem;
		grid-gap: 2rem;
		
		padding-top: 2rem;
		justify-content: center;
	}
	
	#user-management-forms {
		display: flex;
		flex-direction: row-reverse;
		padding: 1rem;
	}			
`;

import { User } from './User.js';

//User Management
export function CubeRight() {
	const { AccessToken, request, users } = useContext(AppContext);
	
	const [ firstname, setFirstName ] = useState('');
	const [ lastname, setLastName ]   = useState('');
	const [ alias, setAlias ]		  = useState('');
	const [ email, setEmail ] 		  = useState('');
	const [ password, setPassword ]   = useState('');
	const [ confirm, setConfirm ] 	  = useState('');
	const [ role, setRole ] 		  = useState('');
	
	
	//complex
	function validateEmail(email) {
		var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
		return re.test(email);
	}
	
	//simplified choose your poison
	function emailIsValid (email) {
		return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
	}	
	
	const clearForm = () => {
		setFirstName('');
		setLastName('');
		setAlias('');
		setEmail('');
		setPassword('');
		setConfirm('');
		setRole('');
	}
		
	
	const handleCreateUser = () => {
		if( ![firstname,lastname,alias,email,password,confirm,role].includes("") && validateEmail(email) && (password === confirm) ) {
			let create_user_object = {
				firstname,
				lastname,
				alias,
				email,
				password,
				role
			}
			request('create-user', create_user_object );
			clearForm();
		} else {
			console.log('There was a problem with the form validation.');
		}
	}	
		
	return(
		<StyledCubeRight className="cube-face">
			<span className="cube-face-title">User Management</span>
			<div id="users" className="flex-filler">
				{ users.length > 0 && users.map((user, i) => (
					<div className="user" key={`user-${user._id}`}>
						<User user={user} />
					</div>
				))}
			</div>
			<div id="user-management-forms">
				{AccessToken !== null &&
					<div id="create-user-form" className="form">
						<span className="form-title">Create User</span>
						<input type="text" placeholder="First Name" value={firstname} onChange={(e) => setFirstName(e.target.value)}/>
						<input type="text" placeholder="Last Name" value={lastname} onChange={(e) => setLastName(e.target.value)}/>
						<input type="text" placeholder="alias" value={alias} onChange={(e) => setAlias(e.target.value)}/>
						<input type="text" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)}/>
						<input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}/>
						<input type="password" placeholder="Confirm Password" value={confirm} onChange={(e) => setConfirm(e.target.value)}/>
						<input type="text" placeholder="Role" value={role} onChange={(e) => setRole(e.target.value)}/>
						<div className="form-actions">
							<span className="form-action-button" onClick={(e) => handleCreateUser()}>Create User</span>
						</div>
					</div>
				}			
			</div>
		</StyledCubeRight>	
	)
}
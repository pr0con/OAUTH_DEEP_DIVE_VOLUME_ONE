import React, { useState, useEffect, useContext } from 'react';
import styled from 'styled-components';

import { AppContext } from './AppProvider.js';

const StyledUser = styled.div`

`;

export function User({user}) {	
	const [ loading, setLoading ] = useState(true);
	const [ updatedUser, setUpdatedUser ] = useState({});
	
	const { difference, request } = useContext(AppContext);
	
	
	useEffect(() => {
		let tmp_user_obj = {};
		for (const [key, value] of Object.entries(user)) {
			(key !== '_id') ? tmp_user_obj[key] = value : '';
		}
		setUpdatedUser(tmp_user_obj);
		setLoading(false);		
	},[]);
	
	
	const updateUserObject = (key,value) => {
		setUpdatedUser((uo) => ({ ...uo, [key]:value }));
	}
	
	const handleUpdateUser = () => {
		let updated_user_values = difference(user, updatedUser);
		if(Object.keys(updated_user_values).length > 0) {
			console.log('updating');
			request('update-user',{uid: user._id, update_values: updated_user_values });
		
			//to-do-later
			//check if we are updating a password process here
			
			//check if username or email has been changed process here
		}
	}
	

	return(
		<StyledUser className="form">
			<div className="form-title">
				<span>{ user._id}</span>
				<div className="flex-filler"></div>
				<svg className="kill-document" onClick={(e) => request('kill-user',user._id )} aria-hidden="true" focusable="false" data-prefix="far" data-icon="skull" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M344 200c-30.9 0-56 25.1-56 56s25.1 56 56 56 56-25.1 56-56-25.1-56-56-56zm-176 0c-30.9 0-56 25.1-56 56s25.1 56 56 56 56-25.1 56-56-25.1-56-56-56zM256 0C114.6 0 0 100.3 0 224c0 70.1 36.9 132.6 94.5 173.7 9.7 6.9 15.2 18.1 13.5 29.9l-6.8 47.9c-2.7 19.3 12.2 36.5 31.7 36.5h246.3c19.5 0 34.4-17.2 31.7-36.5l-6.8-47.9c-1.7-11.7 3.8-23 13.5-29.9C475.1 356.6 512 294.1 512 224 512 100.3 397.4 0 256 0zm133.7 358.6c-24.6 17.5-37.3 46.5-33.2 75.7l4.2 29.7H320v-40c0-4.4-3.6-8-8-8h-16c-4.4 0-8 3.6-8 8v40h-64v-40c0-4.4-3.6-8-8-8h-16c-4.4 0-8 3.6-8 8v40h-40.7l4.2-29.7c4.1-29.2-8.6-58.2-33.2-75.7C75.1 324.9 48 275.9 48 224c0-97 93.3-176 208-176s208 79 208 176c0 51.9-27.1 100.9-74.3 134.6z"></path></svg>				
			</div>
			{ loading && <div className="form-loading">Loading...</div> }
			{ !loading &&
				<>
					<input type="text" placeholder="First Name" value={updatedUser.firstname} onChange={(e) => updateUserObject('firstname', e.target.value)}/>
					<input type="text" placeholder="Last Name" value={updatedUser.lastname} onChange={(e) => updateUserObject('lastname', e.target.value)}/>
					<input type="text" placeholder="alias" value={updatedUser.alias} onChange={(e) => updateUserObject('alias', e.target.value)}/>
					<input type="text" placeholder="email" value={updatedUser.email} onChange={(e) => updateUserObject('email', e.target.value)}/>
					<input type="password" placeholder="Password" value={updatedUser.password} onChange={(e) => updateUserObject('password', e.target.value)}/>
					<input type="password" placeholder="Confirm Password" value={updatedUser.confirm} onChange={(e) => updateUserObject('confirm',e.target.value)}/>
					<input type="text" placeholder="Role" value={updatedUser.role} onChange={(e) => updateUserObject('role', e.target.value)}/>
					<div className="form-actions">
						<span className="form-action-button" onClick={(e) => handleUpdateUser()}>Update User</span>
					</div>
				</>
			}
		</StyledUser>
	)
}
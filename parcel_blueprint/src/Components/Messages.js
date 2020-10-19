import React, { useState, useEffect, useContext } from 'react';
import styled from 'styled-components';

import { AppContext } from './AppProvider.js';

const StyledMessages = styled.div`
	position: relative;
	
	min-width: 28rem;
	max-width: 28rem;
	min-height: 40rem;
	max-height: 40rem;
	
	
	
	display: flex;
	flex-direction: column;
	
	font-size: 1.1rem;
	padding: 1rem;
	
	#messages-title {
		border-bottom: 1px solid #ccc;	
	} 
	
	#messages-container {
		display: flex;
		flex-direction: column;
		overflow-y: scroll;	
	}
`;

export function Messages() {
	const { messages } = useContext(AppContext);
	
	return(
		<StyledMessages>
			<span id="messages-title"> Messages </span>
			<div id="messages-container">
				{	messages.length > 0 && messages.map((msg, i) => (
					<div className="message" key={`message-${i}`}>{msg}</div>
				))}
			</div>
		</StyledMessages>	
	)
}
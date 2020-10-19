import React, { useState, useEffect, useContext } from 'react';
import styled from 'styled-components';

import { AppContext } from './AppProvider.js';

const StyledCubeFront = styled.div`
	transform: translateZ(1000px) rotateY(0deg);
`;

import { Login } from './Login.js';

export function CubeFront() {
	const { rs } = useContext(AppContext);	
	
	
	
	return(
		<StyledCubeFront className="cube-face">
			<span className="cube-face-title">NodeJs WebSocket State - ({rs})</span>
			
			<Login />
		</StyledCubeFront>	
	)
}
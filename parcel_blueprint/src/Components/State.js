import React, { useState, useEffect, useContext } from 'react';
import styled from 'styled-components';
import ReactJson from 'react-json-view';

import { AppContext } from './AppProvider.js';

const StyledState = styled.div`
	position: absolute;
	
	top: 0px;
	left: 0px;
	
	width: 0px;
	height: 0px;
	
	background: #fff;
	
	transition: all .2s;
	overflow: hidden;
	
	&.state-open {
		width: 100vw;
		height: 100vh;
	}
`;

export function State() {
	const AppState = useContext(AppContext);
	const { state } = useContext(AppContext);
	
	return(
		<StyledState className={state ? 'state-open' : 'state-closed'}>
			<ReactJson src={AppState} collapsed={false} />
		</StyledState>	
	)
}
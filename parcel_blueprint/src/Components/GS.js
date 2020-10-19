import styled, { createGlobalStyle } from 'styled-components';

export const GS = createGlobalStyle`	
	.mr-5 {
		margin-right: .5rem;	
	}	
	
	.fs-16 { font-size: 1.6rem; }
	
	.flex-filler { flex-grow: 1; }
	
	.form {
		display: flex;
		flex-direction: column;	
		
		border: 1px solid #ccc;
		background: rgba(0,0,0,.8);
		padding: 1rem;		
		
		.form-title {
			display: flex;
			color: #ccc;
			
			svg.kill-document {
				max-height: 1.4rem;
				&:hover { cursor: pointer; }
			}
		}
		
		input[type="text"],
		input[type="password"] {
			position: relative;
			background: transparent;
			border: 1px solid #ccc;
			color: #ccc;
			font-size: 1.8rem;
			font-style: italic;
			font-weight: 500;
			text-indent: 1rem;	
			
			&:not(:first-child) { margin-top: .5rem; }	
			
			&.invalid {
				color: #cc3300;	
			}	
		}
		
		.form-italic-information {
			font-size: 1rem;
			font-style: italic;	
			word-wrap: break-word;
			overflow-wrap: break-word;
			border-top: 1px solid #ccc;
			border-bottom: 1px solid #ccc;
			padding: 0 0 1rem 0;
			margin-top: 1rem;
			
			.form-information-label {
				background: #fff;
				color: #000;
				padding: .4rem;
				max-width: 15rem;
				margin-bottom: .5rem;
			}
			.form-information-data {
				max-height: 20rem;
				overflow-y: scroll;	
			}
		}
		
		.form-actions {
			display: flex;
			flex-direction: row-reverse;
			
			a,
			a:visited {
				color: #ccc;
				text-decoration: none;	
			}
			.form-action-button {
				&:hover {
					color: #acf9fb;
					cursor: pointer;
				}	
			}	
		}
	}
`;
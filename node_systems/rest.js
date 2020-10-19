//Native Packages
const https = require('https');

//3rd Party Packages
const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');

//Our Packages
const utils = require('./utilz.js');

//Routes
const auth_routes = require('./Routes/Auth.js');

//app
const app = express();

//middlewares
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(cors({ origin: true, credentials: true }));

//Apply Routes
app.use(auth_routes);

https.createServer({
	key: utils.k3yc3r7.key,
	cert: utils.k3yc3r7.cert
},
app).listen(1400, () => {
	utils.logData('Rest server running on 1400');
	
	app.use(function(err, req, res, next) {
		res.header('Access-Control-Allow-Origin', 'pr0con.com');
		res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS'); //usually per route
		res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, multipart/form-data');
		
		(err) ? utils.logData('@rest.js error: ', err) : (!err) ? next() : utils.logData("Something went horribly wrong.");
	});
	
	app.get('/', (req,res) => {
		res.json({time: Date().toString()});
	});
});

process.on('unhandledRejection', (err,promise) => {
	console.log(`Caught Promise Rejection @rest.js: ${err.message}`);
});








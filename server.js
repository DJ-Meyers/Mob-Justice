/*
 * Server.js
 *
 * The main portion of this project. Contains all the defined routes for express,
 * rules for the websockets, and rules for the MQTT broker.
 *
 * Refer to the portions surrounded by --- for points of interest
 */
var express   = require('express'),
	app       = express();
var pug       = require('pug');
var sockets   = require('socket.io');
var path      = require('path');
var conf      = require(path.join(__dirname, 'config'));

setupExpress();
setupSocket();

// Helper functions
function setupExpress() {
	app.set('view engine', 'pug'); // Set express to use pug for rendering HTML

	// Setup the 'public' folder to be statically accessable
	var publicDir = path.join(__dirname, 'public');
	app.use(express.static(publicDir));

	// Setup the paths (Insert any other needed paths here)
	// ------------------------------------------------------------------------
	// Home page
	app.get('/', (req, res) => {
		res.render('index', {title: 'Mob Justice'});
	});

	app.get('/join', (req, res) => {
		res.render('join', {title: 'Mob Justice - Join'});
	});

	app.get('/create', (req, res) => {
		res.render('create', {title: 'Mob Justice - Create'});
	});



	//Post Request to create new room
	// app.post('/createGame', (req, res) => {
	// 	console.log(req.body);
	// 	res.send('Creating game: ' + req.body);
	// });

	// Basic 404 Page
	app.use((req, res, next) => {
		var err = {
			stack: {},
			status: 404,
			message: "Error 404: Page Not Found '" + req.path + "'"
		};

		// Pass the error to the error handler below
		next(err);
	});

	// Error handler
	app.use((err, req, res, next) => {
		console.log("Error found: ", err);
		res.status(err.status || 500);

		res.render('error', {title: 'Error', error: err.message});
	});
	// ------------------------------------------------------------------------

	// Handle killing the server
	process.on('SIGINT', () => {
		internals.stop();
		process.kill(process.pid);
	});
}

function setupSocket() {
	var server = require('http').createServer(app);
	var io = sockets(server);

	server.listen(conf.PORT, conf.HOST, () => {
		console.log("Listening on: " + conf.HOST + ":" + conf.PORT);
	});
}

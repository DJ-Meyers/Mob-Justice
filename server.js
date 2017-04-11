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
var bodyParser = require('body-parser');
var urlencodedParser = bodyParser.urlencoded({ extended: false });
var pug       = require('pug');
var socket   = require('socket.io');
var path      = require('path');
var conf      = require(path.join(__dirname, 'config'));

var activeGames = [];

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

	app.get('/play', (req, res) => {
		res.render('play', {title: 'Mob Justice - Play'});
	});

	app.get('/create', (req, res) => {
		res.render('create', {title: 'Mob Justice - Create'});
	});

	app.get('/about', (req, res) => {
		res.render('about', {title: 'Mob Justice - About'});
	});

	app.get('/creators', (req, res) => {
		res.render('creators', {title: 'Mob Justice - Creators'});
	});


	// Post Request to create new room
	app.post('/newGame', urlencodedParser, (req, res) => {
		//Initialize doctor and detective to off
		var doctor = 'off', detective = 'off';
		var users = [];

		//If they're included in the form submission, set them to on.
		if(req.body.doctor) {
			doctor = 'on';
		}
		if(req.body.detective) {
			detective = 'on';
		}

		var user = {
			name:req.body.name,
			role:"citizen"
		};

		//users.push(user);

		var newGame = {
			roomCode:createRoomCode(),
			doctor:doctor,
			detective:detective,
			users: [user]
		};

		activeGames.push(newGame);
		console.log(user.name + " created: " + newGame);
		console.log(activeGames);


		// Connect to the room.

	res.end(JSON.stringify(newGame));
	});

	// Post Request to create new room
	app.post('/joinGame', urlencodedParser, (req, res) => {
		//Find room with given code
		var room = findRoom(req.body.roomCode);

		//Add user to that room
		var user = {
			name:req.body.name,
			role:"citizen"
		};

		room.users.push(user);
		console.log(room);

		res.end(JSON.stringify(user));
	});

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
	var io = socket(server);

	server.listen(conf.PORT, conf.HOST, () => {
		console.log("Server listening on: " + conf.HOST + ":" + conf.PORT);
	});

}

function createRoomCode() {
	var code = "";
	for(var i = 0; i < 4; i++) {
		var letter = String.fromCharCode(Math.random() * (26) + 65);
		code += letter;
	}
	console.log(code);
	return code;
}

function findRoom(code) {
	for(var i = 0; i < activeGames.length; i++) {
		console.log(i + ": " + activeGames[i]);
		var roomCode = activeGames[i].roomCode;
		if(roomCode === code) {
			return activeGames[i];
		}
	}
}

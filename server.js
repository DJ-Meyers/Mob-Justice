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

var activeRooms = [];
var hashstuff = [];//name room id
var disconnect = [];// {roomID, [name]}

// Helper functions

app.set('view engine', 'pug'); // Set express to use pug for rendering HTML

// Setup the 'public' folder to be statically accessable
var publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

var server = require('http').createServer(app);
var io = socket(server);

server.listen(conf.PORT, conf.HOST, () => {
	console.log("Server listening on: " + conf.HOST + ":" + conf.PORT);
});

io.on('connection', function(socket) {
	//TODO join
	socket.on('disconnect', function () {
        console.log(socket.id);
		for(var j = 0; j<hashstuff.length; ++j){
			if(socket.id===hashstuff[j].id){
				console.log('name : '+ hashstuff[j].name+" from room" + hashstuff[j].room);
				for(var i = 0; i<disconnect.length;++i){
					if(hashstuff[j].room===disconnect[i].room){
						console.log("adding "+hashstuff[j].name+" to "+disconnect[i].room);
						disconnect[i].push(hashstuff.name);

					}
					else{
						var socketId = {
							room: disconnect[i].room,
							names: [hashstuff.name],
						}
					}
					hashstuff.splice(j,0);
				}
			}
		}

    });

	socket.on('join', function(roomCode, username) {
		console.log(socket.id);
		console.log(disconnect);
		var disc = false;
		var check = function checkIfExists(){
			for(var j = 0; j < disconnect.length; ++i){
				if(username===disconnect[i]) {
					disconnect.splice(i,0);
					disc = true;
				}
			}
			for(var i = 0; i < hashstuff.length;++i){
				if(username===hashstuff[i]){
					return true;
				}
			}
			return false;
		};
		if(disc){
			console.log("reconnecting a user: "+ username);
			socket.join(roomCode);
			var socketId = {
				room: roomCode,
				name: username,
				id: socket.id
			}
			hashstuff.push(socketId);

		}
		else if(check){

			var socketId = {
				room: roomCode,
				name: username,
				id: socket.id
			}
		hashstuff.push(socketId);
		/*
			Below is the old logic that was used when everything used join.  Use simple logic like
			checking if the roomCode is in activeRooms[].  If it is, do socket.join(roomCode), and
			add the user onto the list of users for that room.  Otherwise, console.log that
			<username> tried to access a room that doesn't exist.  This way, users won't
			accidentally create new rooms when entering the wrong room code.
		*/

		// socket.join(roomCode);
		//lets you know whose joining
		// console.log(username + ' has tried to connect to room ' + roomCode);
		var room = findRoom(roomCode);
	    if(!room) {
			console.log("Room " + roomCode + " doesn't exist.");
		} else {//if you found a legit room, it lets you join
			//TODO shouldnt join an already started room unless you are in it
				socket.join(roomCode);
				addUserToRoom(roomCode,username);//calls function that adds to room
				var host = false;
				io.to(roomCode).emit('newUser', username, host);
				console.log(username + ' has connected to ' + roomCode);

			// //Add the room to activeRooms
			 //console.log(user);
			 //var users = [user];
			// if(!room) {
			// 	room = {
			// 		roomCode: roomCode,
			// 		users: users,
			// 		started: false
			// 	};
			// 	activeRooms.push(room);
			// 	io.to(roomCode).emit('newUser', username);
			// } else {
			// 	if(!room.started) {
			// 		room.users.push(user);
			// 		io.to(roomCode).emit('newUser', username);
			// 	} else {
			// 		console.log( username + ' is attempting to join has already begun.');
			// 	}
			// }
			// console.log(activeRooms);
		}}
	});
	socket.on('getUsers', function(roomCode, username) {
		var room = findRoom(roomCode);
		//console.log(room.users);
		var names = [];
		for(var u = 0; u < room.users.length; u++) {
			var thisName = room.users[u].name;
			//console.log(thisName);
			names.push(thisName);
			//console.log(thisName);
		}
		io.to(roomCode).emit('usersList', names, username);

	});

	socket.on('create', function(roomCode, username) {

		//Connect to the room (Creates a new room, assuming a room with this code doesn't exist.  That should VERY rarely happen.  1/26^4)
		socket.join(roomCode);
		console.log(username + ' has connected to room: ' + roomCode);
		var socketId = {
			room: roomCode,
			sockets: {
				name: username,
				id: socket.id
			}
		}
		hashstuff.push(socketId);
		//Declare this user
		var user = {
			name: username,
			alive: true,
			role: "citizen",
			voted: false
		}

		//Add the room to activeRooms
		var users = [user];
		var room = {
			roomCode: roomCode,
			users: users,
			started: false
		};
		activeRooms.push(room);

		//Send the newUser message to clients that are listening on roomCode
		var host = true;
		io.to(roomCode).emit('newUser', username, host);

	});

	socket.on('startGame', function(roomCode) {
		console.log('Starting Game: ' + roomCode);
		var room = findRoom(roomCode);
		// console.log(room);
		room.started = true;
		assignRoles(room);
		io.to(roomCode).emit('gameStarted');
	});
});

// Setup the paths (Insert any other needed paths here)
// ------------------------------------------------------------------------
// Home page
app.get('/', (req, res) => {
	res.render('index', {title: 'Mob Justice'});
});

app.get('/currentUsers/:roomCode', (req, res) => {
	console.log("recieved a request with room code"+ req.params.roomCode);
	var room = findRoom(req.params.roomCode);
	console.log(room.users);
	var names = [];
	for(var u = 0; u < room.users.length; u++) {
		var thisName = room.users[u].name;
		//console.log(thisName);
		names.push(thisName);
		console.log(thisName);
	}
	// console.log(names);
	res.send(JSON.stringify(names));
});

app.post('/startGame/:roomCode', (req, res) => {
	var room = findRoom(req.params.roomCode);
	room.started = true;
	console.log('Starting Game: ' + req.params.roomCode);
	io.to(req.params.roomCode).emit('gameStarted');
})

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
	for(var i = 0; i < activeRooms.length; i++) {
		//console.log(i + ": " + activeRooms[i]);
		var roomCode = activeRooms[i].roomCode;
		if(roomCode === code) {
			return activeRooms[i];
		}
	}
	//return false;
	console.log("could not find room");
}

function addUserToRoom(code, username) {
	//goes through, finds room, makes a user, and adds it to room's userlist
	for(var i = 0; i < activeRooms.length; i++) {
		if(activeRooms[i].roomCode === code) {
			var user = {
						name: username,
						alive: true,
						role: "citizen"
					}
			activeRooms[i].users.push(user);
		}
	}
}

function assignRoles(room) {
	//<=7 players  -> 2 mafia
	//<=10 players -> 3 mafia
	//<=13 players -> 4 mafia
	//<=16 players -> 5 mafia

	var numPlayers = room.users.length;
	var numMafia = 0, numDoc = 1, numDet = 1;

	if(numPlayers <= 7) {
		numMafia = 2;
	} else if (numPlayers <= 10) {
		numMafia = 3;
	} else if (numPlayers <= 13 ) {
		numMafia = 4;
	} else if (numPlayers <= 16) {
		numMafia = 5;
	}

	var index;
	while(numMafia !== 0) {
		index = Math.floor(Math.random() * numPlayers);
		if(room.users[index].role == "citizen") {
			room.users[index].role = "mafia";
			numMafia--;
		}
	}

	while(numDoc !== 0) {
		index = Math.floor(Math.random() * numPlayers);
		if(room.users[index].role == "citizen") {
			room.users[index].role = "doctor";
			numDoc--;
		}
	}

	while(numDet !== 0) {
		index = Math.floor(Math.random() * numPlayers);
		if(room.users[index].role == "citizen") {
			room.users[index].role = "detective";
			numDet--;
		}
	}

	for(var i = 0; i < room.users.length; i++) {
		console.log(room.users[i].name + ": " + room.users[i].role);
	}
}


//Not needed


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


function setupSocket() {
	var server = require('http').createServer(app);
	var io = socket(server);

	server.listen(conf.PORT, conf.HOST, () => {
		console.log("Server listening on: " + conf.HOST + ":" + conf.PORT);
	});

}

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
var hostID = 0;
// Helper functions

//----------------------------------------------------
// Initialize App
//----------------------------------------------------
app.set('view engine', 'pug'); // Set express to use pug for rendering HTML

// Setup the 'public' folder to be statically accessable
var publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

var server = require('http').createServer(app);
var io = socket(server);

server.listen(conf.PORT, conf.HOST, () => {
	console.log("Server listening on: " + conf.HOST + ":" + conf.PORT);
});

//----------------------------------------------------
// Socket stuff
//----------------------------------------------------
io.on('connection', function(socket) {
	//TODO join
	//TODO add descriptive comment
	socket.on('disconnect', function () {
        // console.log(socket.id );

		for(var j = 0; j<hashstuff.length; ++j){
			if(socket.id===hashstuff[j].id){
				console.log('name : '+ hashstuff[j].name+" from room" + hashstuff[j].room);
				var done = false;
				for(var i = 0; i<disconnect.length;++i){
					if(hashstuff[j].room===disconnect[i].room){
						console.log("adding "+hashstuff[j].name+" to "+disconnect[i].room);
						disconnect[i].names.push(hashstuff.name);
						done = true;
					}
				}
				if(done===false){
					console.log("popping new on");
					var socketId = {
						room: hashstuff[j].room,
						names: [hashstuff[j].name],
					}
					disconnect.push(socketId);
				}
				console.log("trying to remove "+hashstuff[j].name);
				socket.broadcast.emit('removeUser', hashstuff[j].name);
				hashstuff.splice(j,0);

			}
		}

    });
//TODO add descriptive stuff
	function checkIfDisc(roomCode, username){
		for(var u = 0; u < disconnect.length; ++u){
			if(disconnect[u].room===roomCode){
				console.log("here at disconnect");
				for(var j = 0; j < disconnect[u].names.length; ++j){
					console.log("name "+disconnect[u].names[j]);
					if(username===disconnect[u].names[j]) {
						disconnect[u].names.splice(j,0);
						console.log("did real shit");
						return true;
					}
				}
			}
		}
		return false;
	};
	function checkIfExists(roomCode, username){

		//todo move this to new function so shit can happen
			//console.log(hashstuff);
			for(var i = 0; i < hashstuff.length;++i){

				if(username===hashstuff[i].name&&roomCode===hashstuff[i].room){
					console.log("found something");
					return false;
				}
			}
		return true;
	};
	socket.on('join', function(roomCode, username) {
		// console.log(socket.id);
		var disc = checkIfDisc(roomCode,username);
		var check = checkIfExists(roomCode,username);
		if(disc){
			console.log("reconnecting a user: "+ username);
			socket.join(roomCode);
			var socketId = {
				room: roomCode,
				name: username,
				id: socket.id
			}
			socket.broadcast.emit('newUser', username);

			hashstuff.push(socketId);
			socket.emit('successJoin');

		}
		else if(check){
		var room = findRoom(roomCode);
	    if(!room) {
			console.log("Room " + roomCode + " doesn't exist.");
		} else {//if you found a legit room, it lets you join
			var socketId = {
				room: roomCode,
				name: username,
				id: socket.id
			}
			hashstuff.push(socketId);
			//TODO shouldnt join an already started room unless you are in it
				socket.join(roomCode);
				addUserToRoom(roomCode,username);//calls function that adds to room
				var host = false;

				//Let other users know that I joined
				socket.broadcast.to(roomCode).emit('newUser', username);

				//Let this user know they successfully joined
				socket.emit('successJoin');

				console.log(roomCode + ': ' + username + ' has connected.');
		}}
		else{
			socket.emit('failedToCreate');

		}

	});

	//Get users currently in the room
	socket.on('getUsers', function(roomCode, username) {
		//TODO prevent this from breaking when a user enters an invalid room code
		var room = findRoom(roomCode);
		var names = [];
		//console.log(room);
		for(var u = 0; u < room.users.length; u++) {
			var thisName = room.users[u].name;
			names.push(thisName);
		}
		io.to(roomCode).emit('usersList', names, username);
	});

	//Create a new room
	socket.on('create', function(roomCode, username) {

		//Connect to the room (Creates a new room, assuming a room with this code doesn't exist.  That should VERY rarely happen.  1/26^4)
		socket.join(roomCode);

		console.log(roomCode + ': ' + username + ' has connected.');
		var socketId = {
				room: roomCode,
				name: username,
				id: socket.id
		}
		hashstuff.push(socketId);
		//Declare this user
		hostID = socket;
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
			started: false,
			votes: []
		};
		activeRooms.push(room);

		//Send the newUser message to clients that are listening on roomCode


		socket.emit('newUser', username);

	});

	//Start a game
	socket.on('startGame', function(roomCode) {
		// console.log('Starting Game: ' + roomCode);
		var room = findRoom(roomCode);
		// console.log(room);
		room.started = true;
		console.log('\nGame ' + roomCode + " starting");
		assignRoles(room);
		printRemaining(room);

		io.to(roomCode).emit('gameStarted', getUserStatuses(room));
		if(hostID!==0){
		hostID.emit('onCreate', 'for your eyes only');
		}
	});

	//Handle Voting logic for the day
	socket.on('voteDay', function(roomCode, name, target) {
		var room = findRoom(roomCode);
		console.log("\n" + roomCode + ": " + name + " voted for " + target);
		room.votes.push(target);
		if(room.votes.length === room.totalRemaining) {
			console.log("      All votes submitted");
			var votedOut = tallyVotes(room);
			if(votedOut) {
				// console.log(votedOut + ' was voted out');
				voteOut(room, votedOut);
				Socket.to(roomCode).emit('eliminated', votedOut);
			} else {
				console.log('Nobody was voted out');
				Socket.to(roomCode).emit('noElimination')
			}
		} else {
			console.log("      " + room.votes.length + ' out of ' + room.totalRemaining + ' votes submitted');
		}
	});



});


//----------------------------------------------------
// General Helpers
//----------------------------------------------------
function findRoom(code) {
	// console.log('Finding room ' + code)
	for(var i = 0; i < activeRooms.length; i++) {
		var roomCode = activeRooms[i].roomCode;
		if(roomCode === code) {
			// console.log("Room " + code + " found");
			return activeRooms[i];
		}
	}
	//return false;
	console.log("could not find room");
}


//----------------------------------------------------
// Initialization helpers
//----------------------------------------------------
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

	room.totalRemaining = numPlayers;
	room.mafiaRemaining = numMafia;
	room.citizensRemaining = numPlayers - numMafia;
	room.doctorRemaining = 1;
	room.detectiveRemaining = 1;

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

	printPlayers(room);
}


//----------------------------------------------------
// Game Logic Helpers
//----------------------------------------------------

//Print remaining # of each type of player
function printRemaining(room) {
	console.log('\n' + room.roomCode + ': Remaining');
	console.log('      Total: ' + room.totalRemaining);
	console.log('      Mafia: ' + room.mafiaRemaining);
	console.log('      Citizens: ' + room.citizensRemaining);
	console.log('      Doctor: ' + room.doctorRemaining);
	console.log('      Detective: ' + room.detectiveRemaining);
}

function printPlayers(room) {
	console.log('\n' + room.roomCode + ': Players');
	for(var i = 0; i < room.users.length; i++) {
		console.log("      " + room.users[i].name + ": " + room.users[i].role + " - alive: " + room.users[i].alive);
	}
}

//Get alive/dead status of each user
function getUserStatuses (room) {
	var userStatuses = [];
	for(var i = 0; i < room.users.length; i++) {
		userStatuses.push({
			name: room.users[i].name,
			alive: room.users[i].alive
		});
	}

	return userStatuses;
}

//Count the number of votes for each user
function tallyVotes(room) {
	var usersVotedFor = [];
	for(var i = 0; i < room.votes.length; i++) {
		var found = false;
		for(var j = 0; j < usersVotedFor.length; j++) {
			if(room.votes[i] === usersVotedFor[j].name) {
				usersVotedFor[j].num++;
				found = true;
				break;
			}
		}
		if(!found) {
			usersVotedFor.push({
				name: room.votes[i],
				num: 1
			});
		}
		// }
	}

	console.log("\n" + room.roomCode + ": Tallying Votes");
	for(var i = 0; i < usersVotedFor.length; i++) {
		console.log("      " + usersVotedFor[i].num + " votes for " + usersVotedFor[i].name);
	}

	return getMajority(usersVotedFor, room.votes.length);
}

//Determine if there is a majority in the voting
function getMajority(usersVotedFor, totalVotes) {
	var maxVotes = 0, maxTarget = "";
	for(var i = 0; i < usersVotedFor.length; i++) {
		if(usersVotedFor[i].num > maxVotes) {
			maxVotes = usersVotedFor[i].num;
			maxTarget = usersVotedFor[i].name;
		}
	}
	// console.log(maxTarget + ": " + maxVotes);
	if(maxVotes >= totalVotes / 2) {
		return maxTarget;
	} else {
		return null;
	}
}

//Vote out a user by setting alive to false and adjusting the remaining counts
function voteOut(room, votedOut) {
	for (var i = 0; i < room.users.length; i++) {
		if(room.users[i].name === votedOut) {
			console.log('      Eliminating ' + votedOut);
			room.users[i].alive = false;
			eliminate(room, room.users[i]);
		}
	}
	printRemaining(room);
}

//Adjust remaining count of players of each type
function eliminate(room, user) {
	room.totalRemaining--;
	switch(user.role) {
		case "citizen":
			room.citizensRemaining--;
			break;
		case "mafia":
			room.mafiaRemaining--;
			break;
		case "doctor":
			room.doctorRemaining--;
			room.citizensRemaining--;
			break;
		case "detective":
			room.detectiveRemaining--;
			room.citizensRemaining--;
		default:
			break;
	};

}

//----------------------------------------------------
// Routing
//----------------------------------------------------

//Home/Game page
app.get('/', (req, res) => {
	res.render('index', {title: 'Mob Justice'});
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

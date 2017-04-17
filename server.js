getOtherMafia/*
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
var votingTime = 1;
// Helper functions
var discArray = [];
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
	var socketRoomCode = 0;
	var socketUserName = 'notInitialized';
	var socketRoom;
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
				var room = findRoom(hashstuff[j].room);
				var discUser = findUserBySocket(room,socket.id);
				var discRole = discUser.role;
				if(discRole === 'mafia')room.mafiaRemaining--;
				if(discRole === 'detective'){
					room.detectiveRemaining--;
					room.citizensRemaining--;

				}
				if(discRole === 'doctor'){
					room.doctorRemaining--;
					room.citizensRemaining--;
				}
				if(discRole === 'citizen')room.citizensRemaining--;
				room.totalRemaining--;
				console.log("trying to remove "+hashstuff[j].name);
				socket.broadcast.emit('removeUser', hashstuff[j].name);
				//remove from the room
			}
		}

    });

	socket.on('join', function(roomCode, username) {
		// console.log(socket.id);

		var disc = checkIfDisc(roomCode,username);
		var check = checkIfExists(roomCode,username);
		if(disc){
			console.log("reconnecting a user: "+ username);
			socket.join(roomCode);
			socketRoomCode = roomCode;
			socketUserName = username;
			socketRoom = findRoom(roomCode);
			addUserToRoom(socketRoom,socketUserName,socket);//calls function that adds to room

			socket.broadcast.emit('newUser', username);
			socket.emit('successJoin');
		}
		else if(check){
		var room = findRoom(roomCode);
	    if(!room) {
			console.log("Room " + roomCode + " doesn't exist.");
		} else {//if you found a legit room, it lets you join
			//TODO shouldnt join an already started room unless you are in it
				socket.join(roomCode);
				socketRoomCode = roomCode;
				socketUserName = username;
				socketRoom = findRoom(roomCode);
				addUserToRoom(socketRoom,socketUserName,socket);//calls function that adds to room

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
	socket.on('getUsers', function() {
		//TODO prevent this from breaking when a user enters an invalid room code

		var room = socketRoom;
		var names = [];

		//console.log(room);
		for(var u = 0; u < room.users.length; u++) {
			var thisName = room.users[u].name;
			names.push(thisName);
		}
		io.to(socketRoomCode).emit('usersList', names, socketUserName);
	});

	//Create a new room
	socket.on('create', function(roomCode, username) {

		//Connect to the room (Creates a new room, assuming a room with this code doesn't exist.  That should VERY rarely happen.  1/26^4)
		socket.join(roomCode);
		socketRoomCode = roomCode;
		socketUserName = username;
		console.log(roomCode + ': ' + username + ' has connected.');
		//Declare this user
		// console.log(user);

		//Add the room to activeRooms
		var users = [];
		var room = {
			roomCode: roomCode,
			users: users,
			started: false,
			votes: [],
			nightVoting: 0,
			mafiaVoted: [],
			detVoted: '',
			docVoted: '',
			detective: '',
			doctor: ''
		};

		socketRoom = room;
		activeRooms.push(room);
		var users = addUserToRoom(room,socketUserName,socket);
		//Send the newUser message to clients that are listening on roomCode
		socket.emit('newUser', username);

	});
	socket.on('sizeOfRoom', function() {
		io.to(socketRoomCode).emit('sizeOfRoom', socketRoom.users.length);
	});
	//Start a game
	socket.on('startGame', function() {
		// console.log('Starting Game: ' + roomCode);
		console.log(socketUserName+" is starting the game");
		var room = socketRoom
		// console.log(room);
		room.started = true;
		console.log('\nGame ' + socketRoomCode + " starting");
		assignRoles(room);
		printRemaining(room);

		io.to(socketRoomCode).emit('gameStarted');
	});

	socket.on('getMyRole', function() {
		var user = findUser(socketRoom, socketUserName);

		var others = [];
		if(user.role === "mafia") {
			others = getOtherMafia(socketRoom, user);
		}

		socket.emit('myRole', user.role, others);
	});

	socket.on('getUserStatuses', function() {
		var userStatuses = getUserStatuses(socketRoom);

		socket.emit('userStatuses', userStatuses);
	});
	socket.on('getUserStatusesForMafia', function() {
		if(findUserBySocket(socket).role==='mafia'){}
		var userStatuses = getUserStatuses(socketRoom);
		var mafiaGroup = getMafia(socket,'');

		socket.emit('setUpMafiaNightVoting', userStatuses,mafiaGroup);
		}
	});
	//Handle Voting logic for the day
	socket.on('voteDay', function(target) {
		var room = socketRoom;
		console.log("\n" + socketRoomCode + ": " + socketUserName + " voted for " + target);
		room.votes.push(target);

		if(room.votes.length === room.totalRemaining) {
			console.log("      All votes submitted");

			var votedOut = tallyVotes(room);
			if(votedOut) {
				votingTime=1;
				var votedRole = '';
				// console.log(votedOut + ' was voted out');
				for(var s = 0;s<room.users.length;++s){
					if(room.users[s].name === votedOut){
						votedRole = room.users[s].role;
						console.log('voted out person ('+votedOut+') was a '+votedRole);
					}
				}
				voteOut(room, votedOut);

				// console.log(room);
				var remaining = {
					total: room.totalRemaining,
					citizens: room.citizensRemaining,
					mafia: room.mafiaRemaining,
					doctor: room.doctorRemaining,
					detective: room.detectiveRemaining
				};
				// console.log("remainingObj: " + remaining);
				if(checkCitizenWinCondition(room.roomCode)){
					console.log("citizens won");
					io.to(socketRoomCode).emit('citizensWon',getOtherMafia(room,findUserBySocket(room,socket).name),votedOut,votedRole);
				}
				else{
					io.to(socketRoomCode).emit('movingOnToEndDay', votedOut, votedRole, remaining);
				}
			}
			else if(votingTime===0){
					votingTime=1;
					console.log('Nobody was voted out, not revoting');

					// console.log(room);
					var remaining = {
						total: room.totalRemaining,
						citizens: room.citizensRemaining,
						mafia: room.mafiaRemaining,
						doctor: room.doctorRemaining,
						detective: room.detectiveRemaining
					};
					// console.log("remainingObj: " + remaining);
					io.to(socketRoomCode).emit('movingOnToEndDay', null, null, remaining);

			}
			else{
				var remaining = {
					total: room.totalRemaining,
					citizens: room.citizensRemaining,
					mafia: room.mafiaRemaining,
					doctor: room.doctorRemaining,
					detective: room.detectiveRemaining
				};
				votingTime--;
				console.log('Nobody was voted out, revoting');
				room.votes = [];

				io.to(socketRoomCode).emit('revoting');
			}
		}
		else {
			console.log("      " + room.votes.length + ' out of ' + room.totalRemaining + ' votes submitted');
		}
	});

	//this is for when revoting, it deals with server side stuff
	socket.on('serverRevoting', function(){
		var room = socketRoom;
		var userStatuses = getUserStatuses(room);
		room.votes = [];
		socket.emit('settingUpRevoting', userStatuses);
	});

	socket.on('getEliminatedRole', function(name) {
		var room = socketRoom;
		var user = findUser(room, name);
		if(!user.alive) {
			socket.emit('eliminatedRole', user.role);
		}
	});
	socket.on('requestMafiaNightRole', function(){
		//check if mafia
		//TODO wait for everyone

		var mafChoice = ifMafia(socketRoomCode,socket);
		if(mafChoice){
			socket.emit('mafiaVote', getOtherMafia(socketRoom,socketUserName));
		}
		else{
			socket.emit('nonMafiaVote');
		}
				//if so, emit to mafia vote
				//if not, emit to non mafia vote

	});

	socket.on('requestNightRole', function(){
		var role = getRole(socketRoomCode,socket);
		var status = getStatus(socketRoom, socket);
		if(status!==true){
			console.log(socketUserName+" is dead and client is being told");
			socket.emit('waitNightVote');
		}
		else if(role === 'citizen'){
			console.log(socketUserName+" is citizen and client is being told");
			socket.emit('waitNightVote');

		}
		else if(role === 'mafia'){
			console.log(socketUserName+" is mafia and client is being told");
			socket.emit('mafiaVote', getOtherMafia(socketRoom,socketUserName));
		}
		else if(role === 'doctor'){
			console.log(socketUserName+" is doctor and client is being told");
			socket.emit('docVote');

		}
		else if(role === 'detective'){
			console.log(socketUserName+" is detective and client is being told");
			socket.emit('detVote');

		}
		else {
			console.log("didnt do anything");
		}


	});
	socket.on('nightVoting', function(target){
		var room = socketRoom;
		room.nightVoting++;
		console.log("voting "+room.nightVoting+" out of "+room.totalRemaining);
		//put vote places
		if(target===null){
			console.log(socketUserName+" readied up");
		}
		else if(findUserBySocket(socketRoom,socket).role==='mafia'){
			console.log(socketUserName+" voted for "+target+" and is a mafia");
			room.mafiaVoted.push(target);
		}
		else if(findUserBySocket(socketRoom,socket).role==='doctor'){
			room.doctor=socketUserName;
			console.log(socketUserName+" voted for "+target+" and is a doctor");
			room.docVoted=target;
		}
		else if(findUserBySocket(socketRoom,socket).role==='detective'){
			room.detective=socketUserName;
			console.log(socketUserName+" voted for "+target+" and is a mafia");
			room.detVoted=target;
		}
		if(room.nightVoting>=room.users.length){
			console.log("all night voted, time to move on");
			room.votes = [];
			var detectiveTarget = '';
			var mafiaTarget = '';
			var doctorTarget = '';
			var mafiaTargetRole = '';
			if(room.docVoted!==''){
				doctorTarget=room.docVoted;
			}
			if(room.mafiaVoted.length>0){
				mafiaTarget = mafiaVoted(room.mafiaVoted);
				mafiaTargetRole = findUser(socketRoom,mafiaTarget).role;
			}
			if(room.detVoted===''){
				detectiveTarget = room.detVoted;
			}
			if(doctorTarget!==mafiaTarget){
				// if(mafiaTargetRole==='doctor')room.doctorRemaining--;
				// else if (mafiaTargetRole==='detective')room.detectiveRemaining--;
				// else if (mafiaTargetRole==='citizen')room.citizensRemaining--;
				voteOut(socketRoom,mafiaTarget);
				if(room.citizensRemaining===0){
					console.log('mafia won');
					io.to(socketRoomCode).emit('mafiaWon',getMafia(socketRoom),mafiaTarget,getRemainingRoles(socketRoom));
				}
				else{

				console.log("remaining cits are "+room.citizensRemaining);
				io.to(socketRoomCode).emit('startNewDay',mafiaTarget,mafiaTargetRole,getRemainingRoles(socketRoom));
				}
			}
			if(doctorTarget===mafiaTarget){
				//died but saved
				console.log('doc saved someone');
				io.to(socketRoomCode).emit('startNewDay',null,null,getRemainingRoles(socketRoom));

			}
			else if(mafiaTarget!=='' && mafiaTarget!==room.detective){
				//mafia killed detective
				voteOut(socketRoom,mafiaTarget);
				io.to(socketRoomCode).emit('startNewDay',mafiaTarget, mafiaTargetRole,getRemainingRoles(socketRoom));
				if(room.detective!==''){
					var targetRole = getRole(room.roomCode,findUser(room,room.detVoted).socket);
					console.log("detective found someone");
					//TODO emits to everyone.  Fix that ish
					findUser(room,room.detective).socket.emit(socketRoomCode).emit('detectiveMorning',detectiveTarget,targetRole);

				}
			}
			else if(mafiaTarget!==''){
				console.log('no idea');
				voteOut(socketRoom,mafiaTarget);
				io.to(socketRoomCode).emit('startNewDay',mafiaTarget,mafiaTargetRole,getRemainingRoles(socketRoom));
			}
			else {
				console.log('made it throught all cases in night voting, got to edge case that we did not account for');
			}


			room.nightVoting=0;
			room.mafiaVoted=[];
			room.detVoted = '';
			room.docVoted = '';
		}
	});
	socket.on('requestDocNightRole', function(){
		//check if doc exists



		//TODO wait for everyone
		var room = socketRoom;
		readyDocCount++;
		if(readyDocCount===(room.remainingMafia+room.citizensRemaining)){
			readyDocCount=0;
			for(var k = 0; k < room.users.length; ++k){
				var tempSock=room.users[k].socket;

				if(room.doctorRemaining>0){
					var mafChoice = ifDoctor(socketRoomCode,tempSock);
					if(mafChoice){
						tempSock.emit('docVote');
					}
					else{
						tempSock.emit('nonDocVote');
					}
				}
				else if(room.detectiveRemaining>0){
					if(ifDetective(socketRoomCode,tempSock)){
						tempSock.emit('detVote');
					}
					else{
						tempSock.emit('nonDetVote');
					}
				}
				else if(false){//TODO check tally and see if win
					tempSock.emit('mafiaWins',getMafia(socketRoom),mafiaTarget);
				}
				else{
					tempSock.emit('startNewDay');
				}
			}
		}
			//if so, check if role is doc
				//if so, emit doc vote
				//if not, emit non doc vote
			//if not, check if detective is alive
				//if so, check if role is detective
					//if so, emit det vote
					//if not, emit non det vote
				//if not, check if won
				//else send to start morning
	});
	socket.on('requestDetNightRole', function(){
		//TODO wait for everyone
		var room = socketRoom;
		readyDetCount++;
		if(readyDetCount===(room.remainingMafia+room.citizensRemaining)){
			readyDetCount=0;
			for(var k = 0; k < room.users.length; ++k){
				var tempSock=room.users[k].socket;

				if(room.detectiveRemaining>0){
					if(ifDetective(socketRoomCode,tempSock)){
						tempSock.emit('detVote');
					}
					else{
						tempSock.emit('nonDetVote');
					}
				}
				else if(false){//TODO check tally and see if win
					tempSock.emit('mafiaWins');
				}
				else{
					tempSock.emit('startNewDay');
				}
			}
		}
		//check if detective is alive
			//if so, check if role is detective
				//if so, emit det vote
				//if not, emit non det vote
			//if not, tally up and check if mafia won
				//if so, send to game over mafia win
				//if not, send to start morning
	});
	socket.on('readyForMorning', function(){
		//TODO wait for everyone
		var room = socketRoom;
		readyMorningCount++;
		if(readyMorningCount===(room.remainingMafia+room.citizensRemaining)){
			readyMorningCount=0;
			for(var k = 0; k < room.users.length; ++k){
				var tempSock=room.users[k].socket;

				if(false){//TODO check tally and see if win
					tempSock.emit('mafiaWins');
				}
				else{
					tempSock.emit('startNewDay');
				}
			}
		}
		//if not, tally up and check if mafia won
			//if so, send to game over mafia win
			//if not, send to start morning
	});

	socket.on('getIsMafia', function() {
		if(findUserBySocket(socketRoom,socketUserName).role==='mafia')
			socket.emit('isMafia', true);
		else
			socket.emit('isMafia', false);
	});

	socket.on('updateOtherMafia', function( target) {
		// console.log('updating mafia in',roomCode,'that',target,'was targeted');
		var room = socketRoom;
		for(var i = 0; i < room.users.length; i++) {
			// console.log(room.users[i].socketID);
			if(ifMafia(socketRoomCode, room.users[i].socketID)) {
				console.log('sending ' + room.users[i].name + ' ' + target);
				// socket.to(roomCode).emit('mafiaVotedFor', target);
				socket.broadcast.to(room.users[i].socketID).emit('mafiaVotedFor', target);
			}
		}
	});

	socket.on('IsDoctor', function() {
		var room = socketRoom;
		if(findUserBySocket(room,socket).role==='doctor')
			socket.emit('returnIsDoctor', true);
		else
			socket.emit('returnIsDoctor', false);
	});
	socket.on('IsDetective', function() {
		var room = socketRoom;
		if(findUserBySocket(room,socket).role==='detective')
			socket.emit('returnIsDetective', true);
		else
			socket.emit('returnIsDetective', false);
	});
	socket.on('IsCitizen', function() {
		var room = socketRoom;
		if(findUserBySocket(room,socket).role==='detective' || findUserBySocket(room,socket).role==='doctor' || findUserBySocket(room,socket).role==='citizen')
			socket.emit('returnIsCitizen', true);
		else
			socket.emit('returnIsCitizen', false);
	});
	// socket.on('getRemainingRoles', function(roomCode) {
	// 	var room = findRoom(roomCode);
	// 	var remaining = {
	// 		citizens: room.remainingCitizens,
	// 		mafia: room.remainingMafia,
	// 		doctor: room.remainingDoctor,
	// 		detective: room.remainingDetective
	// 	};
	// 	console.log(remaining);
	// 	socket.emit('remainingRoles', remaining);
	// })

});


//----------------------------------------------------
// General Helpers
//----------------------------------------------------
function ifMafia(code,socketID){
	var room = findRoom(code);
	for(var i = 0; i< room.users.length;++i){
		if(room.users[i].socketID===socketID){
			if(room.users[i].role==="mafia"){
				return true;
			}
			else{
				return false;
			}
		}
	}

}
function ifDoctor(code,socket){
	var room = findRoom(code);
	for(var i = 0; i<room.users.length;++i){
		if(room.users[i].socketID===socket.id){
			if(room.users[i].role==="doctor"){
				return true;
			}
			else{
				return false;
			}
		}
	}

}
function mafiaVoted(array)
{
    if(array.length == 0)
        return null;
    var modeMap = {};
    var maxEl = array[0], maxCount = 1;
    for(var i = 0; i < array.length; i++)
    {
        var el = array[i];
        if(modeMap[el] == null)
            modeMap[el] = 1;
        else
            modeMap[el]++;
        if(modeMap[el] > maxCount)
        {
            maxEl = el;
            maxCount = modeMap[el];
        }
    }
    return maxEl;
}
function ifDetective(code,socket){
	var room = findRoom(code);
	for(var i = 0; i<room.users.length;++i){
		if(room.users[i].socketID===socket.id){
			if(room.users[i].role==="detective"){
				return true;
			}
			else{
				return false;
			}
		}
	}

}
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
function getUsersInRoom(roomCode) {
	var room = findRoom(roomCode);
	return room.users;
}

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
function findUserBySocket(room,socket){
	for(var k = 0; k < room.users.length; ++k){
		// console.log("Iterating through users to find socket");
		// console.log('Does socketID:',socketID.id,'match',room.users[k].name,'socketID',room.users[k].socketID,'?');
		if(socket.id===room.users[k].socketID){
			// console.log("found user "+room.users[k].name);
			return room.users[k];
		}
	}
	return false;
}

function findUser(room, name) {
	for(var i = 0; i < room.users.length; i++) {
		if(room.users[i].name === name) {
			return room.users[i];
		}
	}
	return null;
}

//----------------------------------------------------
// Initialization helpers
//----------------------------------------------------
function removeUserFromRoom(room, username, socket) {
	//goes through, finds room, makes a user, and adds it to room's userlist
	console.log("Trying to disconnect "+username+" from roomcode: "+room.roomcode);
			var user = {
					name: username,
					alive: true,
					role: "citizen",
					voted: false,
					socketID: socket.id,
					socket: socket
					}
			room.users.push(user);
}
function addUserToRoom(room, username, socket) {
	//goes through, finds room, makes a user, and adds it to room's userlist
	console.log("adding user to room, the room looks like:" + room.users);
	room.users.push(createUser(username,socket));
	console.log("added user to room, the room now looks like:" + room.users);
}
function createUser(username, socket){
	var user = {
		name: username,
		alive: true,
		role: "citizen",
		voted: false,
		socketID: socket.id,
		socket: socket
	}
	return user;
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

//checks if Mafia won
function checkMafiaWinCondition(roomCode) {
	var room = findRoom(roomCode);
	if(room.mafiaRemaining>room.citizensRemaining)return true;
	else false;
}
//check if Citizens won
function checkCitizenWinCondition(roomCode) {
	var room = findRoom(roomCode);
	if(room.mafiaRemaining===0)return true;
	else false;
}
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
function getName(roomCode, socket){
	var room = findRoom(code);
	for(var i = 0; i<room.users.length;++i){
		if(room.users[i].socketID===socket.id){
			return room.users[i].name;
		}
	}
}
function getRole(roomCode, socket){
	var room = findRoom(roomCode);
	for(var i = 0; i<room.users.length;++i){
		if(room.users[i].socketID===socket.id){
			return room.users[i].role;
		}
	}
}
function getStatus(room, socket){
	for(var i = 0; i<room.users.length;++i){
		if(room.users[i].socketID===socket.id){
			return room.users[i].alive;
		}
	}
}
function getOtherMafia(room, name) {
	var others = [];
	for(var i = 0; i < room.users.length; i++) {
		if(room.users[i].role === "mafia") {
			others.push(room.users[i].name);
		}
	}

	return others;
}
function getMafia(room, name) {
	var others = [];
	for(var i = 0; i < room.users.length; i++) {
		if(room.users[i].role === "mafia") {
			others.push(room.users[i].name);
		}
	}

	return others;
}
function getCitizens(room, name) {
	var others = [];
	for(var i = 0; i < room.users.length; i++) {
		if(room.users[i].role !== "mafia") {
			others.push(room.users[i].name);
		}
	}

	return others;
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
				role: room.users[i].role,
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
		if(usersVotedFor[i].num === maxVotes && usersVotedFor[i].role !== 'mafia'){
			//TODO figure out why this is doing the opposite of what it's supposed to.
			console.log("edge case where even and now mafia: "+usersVotedFor[i].name+" is going to be hung");
			maxVotes = usersVotedFor[i].num;
			maxTarget = usersVotedFor[i].name;
		} else if(usersVotedFor[i].num > maxVotes) {
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
function getRemainingRoles(room){
	var remaining = {
		total: room.totalRemaining,
		citizens: room.citizensRemaining,
		mafia: room.mafiaRemaining,
		doctor: room.doctorRemaining,
		detective: room.detectiveRemaining
	};
	return remaining;
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
//------------------------------------------------------------------------
//spencers stuff
//------------------------------------------------------------------------

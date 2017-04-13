var socket = io.connect();

//----------------------------------------------------
// JQuery object Initialization
//----------------------------------------------------

//Landing View
var landing 			=	$('#landing');
    var createBtn 		=	$('#createBtn');
    var joinBtn			=	$('#joinBtn');

//Create game View
var createDiv			=	$('#createDiv');
    var createName		= 	$('#createName');
    var createSubmit	=	$('#createSubmit');

//Join game View
var joinDiv				=	$('#joinDiv');
    var joinName		=	$('#joinName');
    var joinCode		=	$('#joinCode');
    var joinSubmit		=	$('#joinSubmit');

//Actual Game View
var gameRoom			=	$('#gameRoom');
    var roomCodeTitle   =   $('#roomCodeTitle');
    var roomCodeSpan	=	$('#roomCodeSpan');
    var phase           =   $('#phase');
    var instruction     =   $('#instruction');
    var gamePlayerList	=	$('#gamePlayerList');
    var voteButton      =   $('#voteButton');

//Variables used to enact game Logic
var roomCode = "", name = "", target = " ",connected = false, votingTime=1;


//----------------------------------------------------
// Create/Join Game Logic
//----------------------------------------------------

//Functions for switching to Create/Join View
createBtn.click(function() {
    createDiv.removeClass('hidden').addClass('vertical-center');
    landing.addClass('hidden').removeClass('vertical-center');
});

joinBtn.click(function() {
    joinDiv.removeClass('hidden').addClass('vertical-center');
    landing.addClass('hidden').removeClass('vertical-center');
});

//Functions for creating/joining games.  Create/Join logic is handled on server
createSubmit.click(function() {
    roomCode = createRoomCode();
    name = createName.val();

    createDiv.removeClass('vertical-center').addClass('hidden');
    gameRoom.addClass('long-content').removeClass('hidden');

    console.log(name + " attempting to join " + roomCode);
    socket.emit('create', roomCode, name);

    roomCodeSpan.text(roomCode);

    voteButton.text('Start Game');
    voteButton.click(function() {
        console.log('sending startGame');
        socket.emit('startGame', roomCode);

    });
});

joinSubmit.click(function() {
    //moved this part up here so it joins you to room before printing out people in room
    name = joinName.val();//TODO decide if should set name here
    console.log(name + " attempting to join " + joinCode.val().toUpperCase());
    socket.emit('join', joinCode.val().toUpperCase(), joinName.val());
});


//----------------------------------------------------
// Socket logic
//----------------------------------------------------

//When a new user connects to the room you're in, add them to the playerList
socket.on('newUser', function(username) {
    console.log("'newUser', " + username);
    //console.log(name+" and username: "+username);
    //if(host===true || name!==username){
        addUserToGamePlayerList(username);
    //}
});

socket.on('failedToCreate', function() {
    console.log('failedToCreate');
    //$('#joinDiv').find('form')[0].reset();
    joinDiv.removeClass('vertical-center').addClass('hidden');
    landing.addClass('vertical-center').removeClass('hidden');

});

//When you join a game, get the list of players already in the game and add them to the playerList
socket.on('usersList', function( names, username ){
    console.log("'usersList', " + names + ", " + username);
    if(username===name){
        for(var i = 0;i<names.length;++i){
            addUserToGamePlayerList(names[i]);
        }
    }
});

//after a client disconnects (usually a phone), it will try to rejoin
socket.on( 'disconnect', function () {
    connected = false;
    //try to connect back
    console.log( 'disconnected to server' );

} );

socket.on('onCreate', function(msg) {
    console.log("'onCreate', " + msg);
});

socket.on('successJoin', function(username, host) {
    connected = true;
    console.log("'successJoin', " + username + ", " + host);

    roomCode = joinCode.val().toUpperCase();
    name = joinName.val();

    joinDiv.removeClass('vertical-center').addClass('hidden');
    gameRoom.addClass('long-content').removeClass('hidden');

    //moved this part up here so it joins you to room before printing out people in room
    socket.emit('getUsers',roomCode,name)
    roomCodeSpan.text(roomCode);

    voteButton.prop("disabled", true);
    voteButton.text('Wait on leader to start');
    voteButton.click(function() {

        console.log('Do Nothing');

    });
});

socket.on('removeUser', function(username) {
    console.log("'removeUser', " + username)
    removeUserFromGamePlayerList(username);
});
//When the server responds to the request to start the game
socket.on('gameStarted', function() {
    console.log("'gameStarted'");
    $('.badge-pill').remove();

    beginInstructions();
});
socket.on('myRole', function(role, others) {
    console.log('myRole: ' + role + ", others: " + others);
    //Set instruction based on my role.
    instruction.append("<p><strong>Your Role: </strong>" + role + "</p>");
    if(role === "mafia") {

        var othersString = "";
        for(var i = 0; i < others.length; i++) {
            if(i !== 0) {
                othersString += ", ";
            }

            othersString += others[i];
        }

        instruction.append("<p>The other mafia members are: " + othersString + "</p>");
    }
});
socket.on('userStatuses', function(userStatuses) {
    //For each user, disable the their list group item if they're dead
    $('.list-group-item').each(function() {
        if(!isAlive($(this).text(), userStatuses)) {
            $(this).addClass('disabled');
            $(this).off('click');
        }
    });

    //If this person is alive, allow them to vote
    if(isAlive(name, userStatuses)) {
        voteButton.prop('disabled', false);
        //Prevent users from voting more than once.
        voteButton.one('click', function() {
            console.log('Voting for ' + target);
            $('.active').removeClass('active');
            $('.list-group-item').addClass('disabled');

            $('.list-group-item').off('click');

            instruction.text('Your vote has been submitted.  Waiting on others.');

            socket.emit('voteDay', roomCode, name, target);
            voteButton.addClass('disabled');
        });
    }
});

socket.on('movingOn', function(votedOut) {
    console.log(votedOut + " has been voted out.");
    //TODO spencer - send to next day
});

socket.on('revoting', function() {
        console.log('No elimination.  Revote');
        //revoteDay();
});

socket.on('gameOver', function(winningTeam, teamMembers) {
        console.log(winningTeam+' won with players: '+teamMembers);
        
});

//----------------------------------------------------
// Helper Functions
//----------------------------------------------------

function removeUserFromGamePlayerList(username){
    console.log("trying to remove "+username);
    $("li:contains('"+username+"')").remove();
}

//Add a player to the list and display them in the input group
function addUserToGamePlayerList(username) {
    console.log("adding " + username);
    var thisPlayer = document.createElement('li');
    thisPlayer.classList.add('list-group-item','justify-content-between');
    thisPlayer.appendChild(document.createTextNode(username));
    if(gamePlayerList.children().length === 0) {
        var leaderBadge = document.createElement('span');
        leaderBadge.classList.add('badge','badge-success','badge-pill');
        leaderBadge.appendChild(document.createTextNode('Leader'));
        thisPlayer.appendChild(leaderBadge);
    }

    gamePlayerList.append(thisPlayer);
}

//Generate a random 4 Letter code
function createRoomCode() {
    var code = "";
    for(var i = 0; i < 4; i++) {
        var letter = String.fromCharCode(Math.random() * (26) + 65);
        code += letter;
    }
    //- console.log(code);
    return code;
}

//Is the user with <name> alive?
function isAlive(name, userStatuses) {
    for(var i = 0; i < userStatuses.length; i++) {
        if(userStatuses[i].name === name) {
            console.log(userStatuses[i].name + ": " + userStatuses[i].alive);
            return (userStatuses[i].alive);
        }
    }

    return false;
}
//----------------------------------------------------
// Reconnect Logic
//----------------------------------------------------


function reconnect(roomcode, username) {
    if(connected===false){
        //tell socket that you are trying to reconnect
        if(connected===false){
            setTimeout(reconnect, 5000);
        }
    }
}

//----------------------------------------------------
// Game Logic
//----------------------------------------------------

//Begin Instructions phase, so players understand the objective and their role
function beginInstructions() {
    //Hide player list
    gamePlayerList.addClass('hidden');

    //Set phase to Instructions, change alert color
    phase.text(' - Roles & Instructions');
    roomCodeTitle.removeClass('alert-info').addClass('alert-warning');
    instruction.html("<p>Mob Justice is a game in which citizens must take their town back from the Mafia that has been killing them one by one.  Every day the citizens will meet and try to figure out who is a member of the mafia.  They will have to decide on one member of the town to be killed.  If the citizens successfully eliminate all the members of the Mafia, then their town is saved and they win the game.</p><p>However, the Mafia can blend into the daily meetings and get to voice their opinions on who should be killed.  Additionally, the Mafia will continue kill one citizen every night.  If all the citizens are killed, the Mafia rule the town and win the game.</p><p>Among the citizens are a doctor and a detective.  Each night, the doctor can save one person (including themselves) from being killed by the mafia; however, they cannot save the same person two nights in a row.  Every night, the detective can uncover the role of any other member of the town.  The Doctor and Detective should be wary about revealing their roles, as the Mafia may choose to target them.</p>");

    //Set button to "I'm Ready"
    voteButton.off('click');
    voteButton.text("I'm Ready");
    voteButton.prop('disabled', false);
    //Prevent users from voting more than once.


    // Get my role
    socket.emit('getMyRole', roomCode, name);
    voteButton.one('click', function() {
        $('.list-group-item').addClass('list-group-item-action');


        beginDay();
    });

    //Change phase to day
    //beginDay();
}

//Begin Day phase of game
function beginDay() {
    votingTime = 1;
    //Replace Phase with Day, change instruction, and change Alert Color
    phase.text(' - Day');
    instruction.text("The day will end when a majority votes to kill a member of the the town.  Click on a player's name then press the submit button to vote for that person.  The citizens win if all mafia members have been killed.");
    gamePlayerList.removeClass('hidden');
    roomCodeTitle.removeClass('alert-warning').addClass('alert-success');

    //Remove eventListeners and disabled status on button for everyone except the dead
    voteButton.off('click');
    voteButton.text('Vote');
    voteButton.addClass('disabled');

    //Add the on click function for all users in the list group to select and target them
    $('.list-group-item').click(function() {
        $('.active').removeClass('active');
        voteButton.removeClass('disabled');

        $(this).addClass('active');
        target = $(this).text();
        console.log('Target: ' + target);
    });


    socket.emit('getUserStatuses', roomCode);
}
function revoteDay() {
    socket.emit('getUserStatuses', roomCode);
}

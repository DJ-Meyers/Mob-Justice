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
var roomCode = "", name = "", target = " ";


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
    name = joinName.val();
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

socket.on('onCreate', function(msg) {
    console.log("'onCreate', " + msg);
});

socket.on('successJoin', function(username, host) {
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
socket.on('gameStarted', function(userStatuses) {
    console.log("'gameStarted', " + userStatuses);
    $('.badge-pill').remove();

    $('.list-group-item').addClass('list-group-item-action');


    //Change phase to day
    beginDay(userStatuses);
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
// Game Logic
//----------------------------------------------------

//Begin Day phase of game
function beginDay(userStatuses) {

    //Replace Phase with Day, change instruction, and change Alert Color
    phase.text(' - Day');
    instruction.text("The day will end when a majority votes to kill a member of the the town.  Click on a player's name then press the submit button to vote for that person.  The citizens win if all mafia members have been killed.");
    roomCodeTitle.removeClass('alert-info').addClass('alert-success');

    //Remove eventListeners and disabled status on button for everyone except the dead
    voteButton.off('click');
    voteButton.text('Vote');

    //Add the on click function for all users in the list group to select and target them
    $('.list-group-item').click(function() {
        $('.active').removeClass('active');

        $(this).addClass('active');
        target = $(this).text();
        console.log('Target: ' + target);
    });

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
}

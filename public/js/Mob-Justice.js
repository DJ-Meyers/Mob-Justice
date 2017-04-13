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
var roomCode = "", name = "", target = "",connected = false, eliminatedRole="", votingTime=1, myRole="";



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
    myRole = role;
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
// now
socket.on('settingUpRevoting', function(userStatuses){
    console.log('trying to revote');
    phase.text(' - Day: Revote');
    instruction.text("The day will end when a majority votes to kill a member of the the town.  Click on a player's name then press the submit button to vote for that person.  The citizens win if all mafia members have been killed.");
    resetVoting(userStatuses);
    //For each user, disable the their list group item if they're dead
    // $('.list-group-item').each(function() {
    //     if(!isAlive($(this).text(), userStatuses)) {
    //         $(this).addClass('disabled');
    //         $(this).off('click');
    //     }
    //     else{
    //         $(this).removeClass('disabled');
    //         //$(this).off('click');
    //     }
    // });
    //
    // //If this person is alive, allow them to vote
    // if(isAlive(name, userStatuses)) {
    //     voteButton.prop('disabled', false);
    //     //Prevent users from voting more than once.
    //     voteButton.on('click', function() {
    //         if(target) {
    //             console.log('Voting for ' + target);
    //             $('.active').removeClass('active');
    //             $('.list-group-item').addClass('disabled');
    //
    //             $('.list-group-item').off('click');
    //
    //             instruction.text('Your vote has been submitted.  Waiting on others.');
    //
    //             socket.emit('voteDay', roomCode, name, target);
    //             voteButton.addClass('disabled');
    //             voteButton.prop('disabled', true);
    //         } else {
    //             console.log('Cannot vote for nobody.');
    //         }
    //     });
    // }
});
socket.on('userStatuses', function(userStatuses) {
    console.log(userStatuses);
    resetVoting(userStatuses, name);
});
socket.on('movingOnToEndDay', function(votedOut, votedRole, remaining) {
    console.log(votedOut + " has been voted out.");
    console.log(remaining);

    //TODO spencer - send to next day
    //Day is over.  Begin Evening
    beginEvening(votedOut, votedRole, remaining);
});

socket.on('revoting', function() {
        //TODO spencer
        console.log('No elimination.  Revote');
        revoteDay();
});

socket.on('gameOver', function(winningTeam, teamMembers) {
        //TODO spencer, maybe look at server and check there
        console.log(winningTeam+' won with players: '+teamMembers);

});

//TODO Spencer replace these by emitting another thing when moving to evening.
socket.on('eliminatedRole', function(role) {
    console.log(role);
    var eliminatedRole = role;
});
socket.on('mafiaVote', function(role) {
    //show voting for mafia
    //emit ready for morning
});
socket.on('nonMafiaVote', function(role) {
    //call show function
    //emit ready for doctor voting
});
socket.on('docVote', function(role) {
    //show voting for doc
    //emit ready for detective voting
});
socket.on('nonDocVote', function(role) {
    //call show function
    //emit ready for detective voting
});
socket.on('detVote', function(role) {
    //show voting for detective
    //emit ready for morning
});
socket.on('nonDetVote', function(role) {
    //call show function
    //emit ready for morning
});
socket.on('startNewDay', function(role) {
});
socket.on('mafiaWins', function(role) {
    console.log('mafia wins');
});

// socket.on('remainingRoles', function(remaining) {
//     var remainingCitizens = remaining.citizens;
//     var remainingMafia = remaining.mafia;
//     var remainingDoctor = remaining.doctor;
//     var remainingDetective = remaining.detective;
// });

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

function resetVoting(userStatuses, name) {
    disableDead(userStatuses);
    disableMe(name);
}

function disableDead(userStatuses) {
    console.log($('.list-group-item'));
    $('.list-group-item').each(function() {
        if(isAlive($(this).text(), userStatuses)) {
            console.log('enabling: ' + $(this));
            enable($(this));
        } else {
            console.log('disabling: ' + $(this));
            disable($(this));
        }
    });
}

function disableMe(name) {
    disable(findNameInJQueryList(name));
}

function findNameInJQueryList(name) {
    return $(".list-group-item:contains('" + name + "')");
}

//Is the user with <name> alive?
function isAlive(name, userStatuses) {
    // console.log('isAlive: ' + userStatuses);
    for(var i = 0; i < userStatuses.length; i++) {
        if(userStatuses[i].name === name) {
            console.log(userStatuses[i].name + ": " + userStatuses[i].alive);
            return (userStatuses[i].alive);
        }
    }
    return false;
}

function disable(jQueryItem) {
    jQueryItem.addClass('disabled');
    jQueryItem.prop('disabled', true);
    jQueryItem.off('click');
}

function enable(jQueryItem) {
    jQueryItem.removeClass('disabled');
    jQueryItem.prop('disabled', false);
    jQueryItem.click(function() {
        $('.active').removeClass('active');

        //enable vote button
        voteButton.removeClass('disabled');
        voteButton.prop('disabled', false);

        $(this).addClass('active');
        target = $(this).text();
        console.log('Target: ' + target);
    });
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
    instruction.html(
        "<p>Mob Justice is a game in which citizens must take their town back from the Mafia that has been killing them one by one.  Every day the citizens will meet and try to figure out who is a member of the mafia.  They will have to decide on one member of the town to be killed.  They will have two chances to try to form a majority voting on which player to kill.  If the citizens fail to form a majority, they will have one more chance to vote that day.  If they fail to form a majority, they do not kill anyone.  If the citizens successfully eliminate all the members of the Mafia, then their town is saved and they win the game.</p><p>However, the Mafia can blend into the daily meetings and get to voice their opinions on who should be killed.  Additionally, the Mafia will continue kill one citizen every night.  If all the citizens are killed, the Mafia rule the town and win the game.</p><p>Among the citizens are a doctor and a detective.  Each night, the doctor can save one person (including themselves) from being killed by the mafia; however, they cannot save the same person two nights in a row.  Every night, the detective can uncover the role of any other member of the town.  The Doctor and Detective should be wary about revealing their roles, as the Mafia may choose to target them.</p>"
    );

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

}

//Begin Day phase of game
function beginDay() {
    votingTime = 1;
    target = "";
    //Replace Phase with Day, change instruction, and change Alert Color
    phase.text(' - Day');
    instruction.html("<p>The day will end when a majority votes to kill a member of the the town.  Click on a player's name then press the submit button to vote for that person.  The citizens win if all mafia members have been killed.</p>");
    gamePlayerList.removeClass('hidden');
    roomCodeTitle.removeClass('alert-warning').addClass('alert-success');


    socket.emit('getUserStatuses', roomCode);

    //Remove eventListeners and disabled status on button for everyone except the dead
    voteButton.text('Vote');
    disable(voteButton);
    voteButton.click(function() {
        socket.emit('voteDay', roomCode, name, target);
    });

    //Add the on click function for all users in the list group to select and target them
    // $('.list-group-item').click(function() {
    //     $('.active').removeClass('active');
    //     voteButton.removeClass('disabled');
    //
    //     $(this).addClass('active');
    //     target = $(this).text();
    //     console.log('Target: ' + target);
    // });
    //
    // $('li:contains("' + name + '")').off('click').addClass('disabled');

}

function beginEvening(votedOut, votedRole, remaining) {
    //Hide player list
    gamePlayerList.addClass('hidden');
    var remaining, eliminatedRole;
    //Set phase to Instructions, change alert color
    phase.text(' - Evening');
    roomCodeTitle.removeClass('alert-success').addClass('alert-warning');
    // socket.emit('getRemainingRoles', roomCode);
    if(votedOut) {
        instruction.html("<p>You killed <strong>" + votedOut + "</strong> who was a " + votedRole + ".  There are currently " + remaining.total + " total remaining townspeople, including " + remaining.citizens + " citizens, " + remaining.mafia + " mafia, " + remaining.doctor + " doctor, and " + remaining.detective + " detective.</p>");
    } else {
        instruction.html("<p>Nobody was killed today.  There are currently " + remaining.total + " total remaining townspeople, including " + remaining.citizens + " citizens, " + remaining.mafia + " mafia, " + remaining.doctor + " doctor, and " + remaining.detective + " detective.</p>");
    }

    //Set button to "I'm Ready"
    voteButton.off('click');
    voteButton.text("I'm Ready");
    voteButton.prop('disabled', false);
    voteButton.removeClass('disabled');
    //Prevent users from voting more than once.


    voteButton.one('click', function() {

        beginNight();
    });

    //Change phase to day
    //beginDay();
}

function beginNight() {
    console.log('It is night, my dudes.  AHHHHH');
    //spencer
    //send request to night for what to do
    //recieve what to do back

    //spencer


    target = "";
    //Replace Phase with Day, change instruction, and change Alert Color
    phase.text(' - Night');
    instruction.html("<p>The night will end after the mafia votes to kill a member of the the town.  Mafia members will click on a player's name to indicate their choice to the other mafia members.  The mafia members then press the submit button to vote for that person when they are ready.  The mafia wins if they outnumber the citizens.</p><p>The citizens can choose to ready up whenever they want.  Try not to look at who else is pressing buttons on their phone to get an unfair advantage.</p>");
    gamePlayerList.removeClass('hidden');
    roomCodeTitle.removeClass('alert-warning').addClass('alert-danger');

    socket.emit('getUserStatuses', roomCode);

    //Remove eventListeners and disabled status on button for everyone except the dead
    voteButton.off('click');
    voteButton.text('Vote');
    voteButton.addClass('disabled');
    voteButton.prop('disabled', true);

    //Add the on click function for all users in the list group to select and target them
    if(myRole === "mafia") {
        $('.list-group-item').click(function() {
            $('.active').removeClass('active');
            voteButton.removeClass('disabled');

            $(this).addClass('active');
            target = $(this).text();
            console.log('Target: ' + target);
        });
    } else {
        $('.list-group-item').removeClass('active').addClass('disabled').prop('disabled', true).off('click');
    }


    $('li:contains("' + name + '")').off('click').addClass('disabled');
    //spencer
    //send me mafia night role
}


function revoteDay() {
    socket.emit('serverRevoting', roomCode);
}

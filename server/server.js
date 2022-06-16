var WebSocketServer = require('websocket').server;
var http = require('http');
//Criando um server web
var server = http.createServer(function(request,response){
    response.writeHead(200, {'Content-Type': 'text/plain'});
    response.end("This is the node.js HTTP server.");
});

server.listen(8080,function(){
    console.log('Server has started listening on port 8080');
});

var wsServer = new WebSocketServer({
    httpServer:server,
    autoAcceptConnections: false        
});

// Verifica se o request funcionou e retorna
function connectionIsAllowed(request){ 
    return true;
}

// Inicializando as salas com valor status: empty
var gameRooms = [];
for (var i=0; i < 10; i++) {
    gameRooms.push({status:"empty",players:[],roomId:i+1});
};

 var players = [];
wsServer.on('request',function(request){
    if(!connectionIsAllowed(request)){
        request.reject();
        console.log('Connection from ' + request.remoteAddress + ' rejected.');
        return;
    }
    
    var connection = request.accept();
    console.log('Connection from ' + request.remoteAddress + ' accepted.');
    
    //Adicionando os players ao array
    var player = {
        connection:connection,
    }

    players.push(player);

    // Enviando a lista de salas ao primeiro jogador conectado
    sendRoomList(connection);


   
	connection.on('click', function(event) {
        var text = "";
        var msg = JSON.parse(event.data);
        console.log(msg);

    })
    
	connection.on('message', function(message) {
	    if (message.type === 'utf8') {
	        var clientMessage = JSON.parse(message.utf8Data);

	        switch (clientMessage.type){
	            case "join_room":
	                var room = joinRoom(player,clientMessage.roomId);

	                sendRoomListToEveryone();

	                if(room.players.length == 2){
	                    startGame(room);
	                }
	                break;                
	            case "leave_room":
	                leaveRoom(player,clientMessage.roomId);

	                sendRoomListToEveryone();

	                break;    
				case "lose_game": // Implementar junto ao start.js
					endGame(player.room, "The "+ player.color +" team has been defeated.");      

					break;

                case "fire":
                    const id = clientMessage.shotFired;
                
                    console.log(`Shot fired on`, id)             

					break;
	        }
	    }
        
        
    });

    connection.on('close', function(reasonCode, description) {
	    console.log('Connection from ' + request.remoteAddress + ' disconnected.');

	    for (var i = players.length - 1; i >= 0; i--){
	        if (players[i]==player){
	            players.splice(i,1);
	        }
	    };

	    // Se o jogador conectar na sala, remova ele do lobby e notifique aos demais players
	    if(player.room){
	        var status = player.room.status;
	        var roomId = player.room.roomId;
	        // Se o jogo estiver em andamento, pare o jogo e notifique o jogador que restou         
	        if(status=="running"){                
	            endGame(player.room, "The "+ player.color +" player has disconnected.");                
	        } else {
	            leaveRoom(player,roomId);
	        }            
	        sendRoomListToEveryone();            
	    }

	});
});

function iniciarEvent() {
    ws.addEventListener("message", ({ data }) => {
      const packet = JSON.parse(data);
      console.log(packet);
    })
}

function recebeBarcos() {
        
}

function sendRoomList(connection){
    var status = [];

    for (var i=0; i < gameRooms.length; i++) {
        status.push(gameRooms[i].status);
    };

    var clientMessage = {
        type: "room_list",
        status: status
    };

    connection.send(JSON.stringify(clientMessage));
}

function sendRoomListToEveryone(){
    // Notifica todos os jogadores o status da sala
    var status = [];

    for (var i=0; i < gameRooms.length; i++) {
        status.push(gameRooms[i].status);
    };

    var clientMessage = {
        type: "room_list",
        status: status
    };

    var clientMessageString = JSON.stringify(clientMessage);

    for (var i=0; i < players.length; i++) {
        players[i].connection.send(clientMessageString);
    };
}

function joinRoom(player,roomId){
    var room = gameRooms[roomId-1];

    console.log("Adding player to room",roomId);
    // Adicionando o player a sala
    room.players.push(player);

    player.room = room;        

    // Atualizando o status da sala
    if(room.players.length == 1){
        room.status = "waiting";
        player.color = "green";
    } else if (room.players.length == 2){
        room.status = "starting";
        player.color = "yellow";
    }

    // Confirmação 
    var confirmationMessageString = JSON.stringify({
        type: "joined_room", 
        roomId: roomId, 
        color: player.color
    });

    player.connection.send(confirmationMessageString);

    return room;
}

function leaveRoom(player,roomId){
    var room = gameRooms[roomId-1];

    console.log("Removing player from room",roomId);
     
    for (var i = room.players.length - 1; i >= 0; i--){
        if(room.players[i]==player){
            room.players.splice(i,1);
        }
    };

    delete player.room;

    // Atualizando o status da sala
    if(room.players.length == 0){
        room.status = "empty";    
    } else if (room.players.length == 1){
        room.status = "waiting";
    }
}

function startGame(room){
    console.log("Both players are ready. Starting game in room",room.roomId);

    room.status = "running";

    sendRoomListToEveryone();

    // Notificando os jogadores quando o jogo começa
    sendRoomWebSocketMessage(room, {
        type:"start_game"
    });

    //função para parar o jogo em 3seg
    setTimeout(function() {
        endGame(room);
    }, 3000);
}

function sendRoomWebSocketMessage(room,messageObject){
    var messageString = JSON.stringify(messageObject);

    for (var i = room.players.length - 1; i >= 0; i--){
        room.players[i].connection.send(messageString);
    }; 
}

function endGame(room){
    clearInterval(room.interval);

    room.status = "empty";

    sendRoomWebSocketMessage(room, {
        type: "end_game"
    })

    for (var i = room.players.length - 1; i >= 0; i--){
        leaveRoom(room.players[i],room.roomId);        
    };     

    sendRoomListToEveryone();
}


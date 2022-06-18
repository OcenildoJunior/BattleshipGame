let userGrid = undefined
let opponentGrid = undefined
let turnDisplay = undefined

let currentPlayer = 'user' 
const width = 10
const userSquares = []
const opponentSquares = []
const qtdBarco = []
var vida = 2
var count = 0;

let playerId = ""

const statusMessages = {
  'starting': 'Game Starting',
  'running':'Game in Progress',
  'waiting':'Awaiting second player',
  'empty':'Open'
}

document.addEventListener('DOMContentLoaded', () => {
	userGrid = document.querySelector('.grid-user')
	opponentGrid = document.querySelector('.grid-opponent')
	turnDisplay = document.querySelector('#whose-go')

  createBoard(userGrid, userSquares, width)
  createBoard(opponentGrid, opponentSquares, width)

  // 'EventListener' no campo do player para o jogador definir o tabuleiro dele
  userSquares.forEach(square => {
    square.addEventListener('click', () => {
      count++;
      
      if(currentPlayer === 'user' && count <= vida) {
        shotFired = square.dataset.id    

        qtdBarco.push(shotFired)
        
        square.style.backgroundColor = 'green';
        square.style.pointerEvents = 'none';
      }
    })
  })
  
  // 'EventListener' no campo adversário para enviar a informação para o servidor
  opponentSquares.forEach(square => {
    square.addEventListener('click', () => {
      square.style.pointerEvents = 'none';
  
      if(currentPlayer === 'user') {
        shotFired = square.dataset.id

        console.log(multiplayer.currentRoom);
  
        multiplayer.sendWebSocketMessage({
          type: "shot",
          shotFired: shotFired,
					playerShot: playerId
        });
      }
    });
  });

  // Iniciar o servidor
  multiplayer.start()
})

var multiplayer = {
	websocket_url: "ws://localhost:8080/",
	websocket: undefined,
	currentRoom: undefined,
	currentLevel: 0,

	start: function(){
		game.type = "multiplayer";
		var WebSocketObject = window.WebSocket || window.MozWebSocket;

		if (!WebSocketObject){
			game.showMessageBox("Your browser does not support WebSocket. Multiplayer will not work.");
			return;
		}

		this.websocket = new WebSocketObject(this.websocket_url);

		this.websocket.onmessage = multiplayer.handleWebSocketMessage;

		this.websocket.onopen = function(){			
			$('.gamelayer').hide();
			$('#gameinterfacescreen').hide();
			$('#multiplayerlobbyscreen').show();

      // Envia o id do usuário se for uma conexão pelo game-match.html
      if (userGrid != null) {
        const id = generateString(16);

				playerId = id;
  
				// // Para possivelmente tratar os ids dos players
        // multiplayer.sendWebSocketMessage({
        //   type: "getPlayerId",
        //   playerId: id
        // })
      }
		}
	
		this.websocket.onclose = function(){			
			multiplayer.endGame("Error connecting to server.");
		}
	
		this.websocket.onerror = function(){			
			multiplayer.endGame("Error connecting to server.");
		}
	},
	handleWebSocketMessage: function(message){
			var messageObject = JSON.parse(message.data);

			switch (messageObject.type){
        // Para a partida
        case "shot-received":
					if (messageObject.playerShot != playerId) {
						// console.log("Here1 - Shot Received");

						verifyShot(messageObject.shotFired)
					}
        break;

        case "shot-reply":
					if (messageObject.playerShot != playerId) {
						// console.log("Here2 - Shot Reply");

						const shotId = messageObject.shotFired;
            const result = messageObject.result;

						opponentSquares[shotId].style.backgroundColor = result
					}
        break;

        // Para o lobby
        case "room_list":
            multiplayer.updateRoomStatus(messageObject.status);
        break;    
				case "joined_room":
						multiplayer.roomId = messageObject.roomId;
						multiplayer.color = messageObject.color;
				break;
				case "init_level":
						multiplayer.initMultiplayerLevel(messageObject);
				break;
				case "start_game":
						multiplayer.startGame();
				break;
				case "latency_ping":
						multiplayer.sendWebSocketMessage({
							type: "latency_pong"
						});
				break;    
				case "game_tick":
						multiplayer.lastReceivedTick = messageObject.tick;
						multiplayer.commands[messageObject.tick] = messageObject.commands;
				break;  
				case "end_game":
						multiplayer.endGame(messageObject.reason);
				break;                
				case "chat":
						game.showMessage(messageObject.from,messageObject.message);
				break;        
			}        
	},
	sendWebSocketMessage: function(messageObject){
		this.websocket.send(JSON.stringify(messageObject));

		console.log(messageObject);
	},
	updateRoomStatus: function(status){
		// console.log("Entrou em updateRoomStatus");

		var $list = $("#multiplayergameslist");
		$list.empty();

		for (var i = 0; i < status.length; i++) {
				var key = "Game " + (i+1) + ": " + statusMessages[status[i]];

				$list
				.append($("<option></option>")
				.attr("disabled", status[i] == "running" || status[i] == "starting")
				.attr("value", (i+1))
				.text(key)
				.addClass(status[i])
				.attr("selected", (i+1) == multiplayer.roomId));

				if (status[i] == "running" && (i + 1 == this.currentRoom)) {
					location.assign("/client/game-match.html")
				}
		};    
	},
	join: function(){
		console.log("Entrou em join");

		var selectedRoom = document.getElementById('multiplayergameslist').value;

    console.log(game.roomId);

		this.currentRoom = selectedRoom;
    game.roomId = selectedRoom;

    console.log(game.roomId);

		if(selectedRoom){            
				multiplayer.sendWebSocketMessage({
					type: "join_room",
					roomId: selectedRoom
				});

				document.getElementById('multiplayergameslist').disabled = true;
				document.getElementById('multiplayerjoin').disabled = true;        
		} else {
				game.showMessageBox("Please select a game room to join.");            
		}
	}, 
	cancel: function(){
		if(multiplayer.roomId){			
			multiplayer.sendWebSocketMessage({
				type: "leave_room",
				roomId: multiplayer.roomId
			});

			document.getElementById('multiplayergameslist').disabled = false;
			document.getElementById('multiplayerjoin').disabled = false;

			this.currentRoom = undefined;

			delete multiplayer.roomId;
			delete multiplayer.color;
			return;
		} else {
			multiplayer.closeAndExit();
		}
	},
	closeAndExit: function(){
		multiplayer.websocket.onopen = null;
		multiplayer.websocket.onclose = null;
		multiplayer.websocket.onerror = null;		
		multiplayer.websocket.close();
	
		document.getElementById('multiplayergameslist').disabled = false;
		document.getElementById('multiplayerjoin').disabled = false;
		$('.gamelayer').hide();
	  $('#gamestartscreen').show();			
	},
	initMultiplayerLevel: function(messageObject){
	    $('.gamelayer').hide();        
	    var spawnLocations = messageObject.spawnLocations;

	    multiplayer.commands = [[]];    
	    multiplayer.lastReceivedTick = 0;
	    multiplayer.currentTick = 0;    

	    game.team = multiplayer.color;

	    multiplayer.currentLevel = messageObject.level;
	    var level = maps.multiplayer[multiplayer.currentLevel];

	    game.currentMapImage = loader.loadImage(level.mapImage);
	    game.currentLevel = level;

	    game.resetArrays();
	    for (var type in level.requirements){
	           var requirementArray = level.requirements[type];
	           for (var i=0; i < requirementArray.length; i++) {
	               var name = requirementArray[i];
	               if (window[type]){
	                   window[type].load(name);
	               } else {
	                   console.log('Could not load type :',type);
	               }
	           };
	     }

	    for (var i = level.items.length - 1; i >= 0; i--){
	        var itemDetails = level.items[i];
	        game.add(itemDetails);
	    };        

	    for (team in spawnLocations){
	        var spawnIndex = spawnLocations[team];
	        for (var i=0; i < level.teamStartingItems.length; i++) {
	            var itemDetails = $.extend(true,{},level.teamStartingItems[i]);
	            itemDetails.x += level.spawnLocations[spawnIndex].x+itemDetails.x;
	            itemDetails.y += level.spawnLocations[spawnIndex].y+itemDetails.y;
	            itemDetails.team = team;
	            game.add(itemDetails);            
	        };

	        if (team==game.team){                
	            game.offsetX = level.spawnLocations[spawnIndex].startX*game.gridSize;
	            game.offsetY = level.spawnLocations[spawnIndex].startY*game.gridSize;
	        }
	    }


	    game.currentMapTerrainGrid = [];
	    for (var y=0; y < level.mapGridHeight; y++) {
	        game.currentMapTerrainGrid[y] = [];
	           for (var x=0; x< level.mapGridWidth; x++) {
	            game.currentMapTerrainGrid[y][x] = 0;
	        }
	    };
	    for (var i = level.mapObstructedTerrain.length - 1; i >= 0; i--){            
	        var obstruction = level.mapObstructedTerrain[i];
	        game.currentMapTerrainGrid[obstruction[1]][obstruction[0]] = 1;
	    };
	    game.currentMapPassableGrid = undefined;

	    game.cash = $.extend([],level.cash);

	    if (loader.loaded){
	        multiplayer.sendWebSocketMessage({type:"initialized_level"});

	    } else {
	        loader.onload = function(){
	            multiplayer.sendWebSocketMessage({type:"initialized_level"});
	        }
	    }
	},
	startGame: function(){
	    // fog.initLevel();
	    // game.animationLoop();                                
	    // multiplayer.animationInterval = setInterval(multiplayer.tickLoop, game.animationTimeout);
	    // game.start();                
	},
	sendCommand: function(uids,details){
	    multiplayer.sentCommandForTick = true;

	    multiplayer.sendWebSocketMessage({
				type: "command",
				uids: uids, 
				details: details,
				currentTick: multiplayer.currentTick
			});
	},
	tickLoop: function(){        
	    if(multiplayer.currentTick <= multiplayer.lastReceivedTick){
	        var commands = multiplayer.commands[multiplayer.currentTick];

	        if(commands){
	            for (var i=0; i < commands.length; i++) {                
	                game.processCommand(commands[i].uids,commands[i].details);
	            };
	        }

	        game.animationLoop();

	        if (!multiplayer.sentCommandForTick){
	            multiplayer.sendCommand();
	        }

	        multiplayer.currentTick++;
	        multiplayer.sentCommandForTick = false;
	    }
	},    
	loseGame: function(){
	    multiplayer.sendWebSocketMessage({
				type: "lose_game"
			});
	},
	endGame: function(reason){
	    game.running = false

	    clearInterval(multiplayer.animationInterval);

	    game.showMessageBox(reason,multiplayer.closeAndExit);
	}
};

function verifyShot(shotFired) {
	var result = '';

	if(qtdBarco.indexOf(shotFired) > -1 && qtdBarco.length === vida) {

		userSquares[shotFired].style.backgroundColor = 'red';

		result = 'red'
	} else if(qtdBarco.length === vida && vida >= 1){

		userSquares[shotFired].style.backgroundColor = 'blue';
		count = 0

		result = 'blue'
	}

	multiplayer.sendWebSocketMessage({
		type: "shot-reply",
		shotFired: shotFired,
		result: result,
		playerShot: playerId
	})
}

// Criar tabuleiro
function createBoard(grid, squares, width) {
  for (let i = 0; i < width * width; i++) {
    const square = document.createElement('div')
    square.dataset.id = i
    grid.appendChild(square)
    squares.push(square)
  }
}

// Program to generate random strings
function generateString(length) {
    // declare all characters
    const characters ='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    let result = ' ';
    const charactersLength = characters.length;
    for ( let i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }

    return result;
}
var multiplayer = {
    websocket_url:"ws://localhost:8080/",
    websocket:undefined,
	start:function(){
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
		}
	
		this.websocket.onclose = function(){			
			multiplayer.endGame("Error connecting to server.");
		}
	
		this.websocket.onerror = function(){			
			multiplayer.endGame("Error connecting to server.");
		}
	},
    handleWebSocketMessage:function(message){
        var messageObject = JSON.parse(message.data);
        switch (messageObject.type){
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
	            multiplayer.sendWebSocketMessage({type:"latency_pong"});
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
    statusMessages:{
        'starting':'Game Starting',
        'running':'Game in Progress',
        'waiting':'Awaiting second player',
        'empty':'Open'
    },
    updateRoomStatus:function(status){
		console.log("Entrou em updateRoomStatus");
        var $list = $("#multiplayergameslist");
        $list.empty();
        for (var i=0; i < status.length; i++) {
            var key = "Game "+(i+1)+". "+this.statusMessages[status[i]];            
            $list.append($("<option></option>").attr("disabled",status[i]== "running"||status[i]== "starting").attr("value", (i+1)).text(key).addClass(status[i]).attr("selected", (i+1)== multiplayer.roomId));
        };    
    },
	join:function(){
		console.log("Entrou em join");
	    var selectedRoom = document.getElementById('multiplayergameslist').value;
	    if(selectedRoom){            
	        multiplayer.sendWebSocketMessage({type:"join_room",roomId:selectedRoom});    
	        document.getElementById('multiplayergameslist').disabled = true;
	        document.getElementById('multiplayerjoin').disabled = true;        
	    } else {
	        game.showMessageBox("Please select a game room to join.");            
	    }
	}, 
	cancel:function(){
		if(multiplayer.roomId){			
			multiplayer.sendWebSocketMessage({type:"leave_room",roomId:multiplayer.roomId});
			document.getElementById('multiplayergameslist').disabled = false;
			document.getElementById('multiplayerjoin').disabled = false;
			delete multiplayer.roomId;
			delete multiplayer.color;
			return;
		} else {
			multiplayer.closeAndExit();
		}
	},
	closeAndExit:function(){
		multiplayer.websocket.onopen = null;
		multiplayer.websocket.onclose = null;
		multiplayer.websocket.onerror = null;		
		multiplayer.websocket.close();
	
		document.getElementById('multiplayergameslist').disabled = false;
		document.getElementById('multiplayerjoin').disabled = false;
		$('.gamelayer').hide();
	    $('#gamestartscreen').show();			
	},
	sendWebSocketMessage:function(messageObject){
	    this.websocket.send(JSON.stringify(messageObject));
		console(messageObject);
	},
	currentLevel:0,
	initMultiplayerLevel:function(messageObject){
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
	startGame:function(){
	    fog.initLevel();
	    game.animationLoop();                                
	    multiplayer.animationInterval = setInterval(multiplayer.tickLoop, game.animationTimeout);
	    game.start();                
	},
	sendCommand:function(uids,details){
	    multiplayer.sentCommandForTick = true;
	    multiplayer.sendWebSocketMessage({type:"command",uids:uids, details:details,currentTick:multiplayer.currentTick});
	},
	tickLoop:function(){        
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
	loseGame:function(){
	    multiplayer.sendWebSocketMessage({type:"lose_game"});
	},
	endGame:function(reason){
	    game.running = false
	    clearInterval(multiplayer.animationInterval);
	    game.showMessageBox(reason,multiplayer.closeAndExit);
	}
};


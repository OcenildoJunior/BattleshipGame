

document.addEventListener('DOMContentLoaded', () => {
  const userGrid = document.querySelector('.grid-user')
  const opponentGrid = document.querySelector('.grid-opponent')
  const turnDisplay = document.querySelector('#whose-go')

  const websocket_url = "ws://localhost:8080/"
	let websocket = undefined

  let currentPlayer = 'user' 

  const width = 10
  const userSquares = []
  const opponentSquares = []
  const qtdBarco = []
  var vida = 7
  createBoard(userGrid, userSquares, width)
  createBoard(opponentGrid, opponentSquares, width)
  
  var count = 0;

  userSquares.forEach(square => {
    square.addEventListener('click', () => {
      count++;
      const localBarcos = []
      if(currentPlayer === 'user' && count <= vida) {
        shotFired = square.dataset.id
        
        qtdBarco.push(shotFired)
        
        square.style.backgroundColor = 'green';
        square.style.pointerEvents = 'none';
        
      //  console.log(shotFired, qtdBarco, count );
      //  console.log(players.color)
        sendWebSocketMessage({
          vida: vida,
          barcos: localBarcos
        })
      }
      
    })
  })
  
  // 'EventListener' no campo adversário para enviar a informação para o servidor
  opponentSquares.forEach(square => {
    square.addEventListener('click', () => {
      square.style.pointerEvents = 'none';

      if(currentPlayer === 'user') {
        sendWebSocketMessage({
          barcos: qtdBarco
        })
        if(qtdBarco.indexOf(square.dataset.id) > -1 && qtdBarco.length === 7) {
          square.style.backgroundColor = 'red';
    
          sendWebSocketMessage({
            type: "fire-reply",
            shotFired: shotFired,
            vida: vida--    
          });
        } else if(qtdBarco.length === 7 && vida >= 1){
          square.style.backgroundColor = 'blue';
          sendWebSocketMessage({
            type: "fire",
            shotFired: shotFired,
          });
        shotFired = square.dataset.id
        count = 0
        }
        
      }
    });
  });
  function turnGame() {

    if(enemyReady) {
      if(currentPlayer === 'user') {
        turnDisplay.innerHTML = 'Sua vez'

      } else if(currentPlayer === 'enemy') {
        turnDisplay.innerHTML = "Vez do inimigo"
      }
    }
  }

  function startGame() {
    var WebSocketObject = window.WebSocket || window.MozWebSocket;

		if (!WebSocketObject){
			console.log("Your browser does not support WebSocket. Multiplayer will not work.");

			return;
		}

		websocket = new WebSocketObject(websocket_url);

		websocket.onmessage = handleWebSocketMessage;

		websocket.onopen = function() {			
			$('.gamelayer').hide();
			$('#gameinterfacescreen').hide();
			$('#multiplayerlobbyscreen').show();	
		}
	
		websocket.onclose = function() {			
			closeAndExit();
		}
	
		websocket.onerror = function() {			
			closeAndExit();
		}
  }

  function handleWebSocketMessage(message) {
    var messageObject = JSON.parse(message.data);

    switch (messageObject.type){
      case "fire":
        
      break;

      case "fire-reply":
        
      break;
    }        
  }

  function sendWebSocketMessage(messageObject) {
		websocket.send(JSON.stringify(messageObject));
    
		console.log(messageObject);
	}

  function closeAndExit() {
    websocket.onopen = null;
		websocket.onclose = null;
		websocket.onerror = null;		
		websocket.close();
	
		document.getElementById('multiplayergameslist').disabled = false;
		document.getElementById('multiplayerjoin').disabled = false;
		$('.gamelayer').hide();
	  $('#gamestartscreen').show();	

    console.log("Error connecting to server.");
  }

  startGame()
})

const statusMessages = {
  'starting': 'Game Starting',
  'running': 'Game in Progress',
  'waiting': 'Awaiting second player',
  'empty': 'Open'
}

//Criar tabuleiro
function createBoard(grid, squares, width) {
  for (let i = 0; i < width * width; i++) {
    const square = document.createElement('div')
    square.dataset.id = i
    grid.appendChild(square)
    squares.push(square)
  }
}
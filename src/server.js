// REQUIRES
// Carregar na web e no sistema de arquivos requires, e socket.io
var http = require("http");				// web server
var socketio = require("socket.io");	// socket.io
var router = require("./router.js");
var GameManager = require("./GameManager.js"); // carrega o GameManager class


// Tente usar a porta global do Node, caso contrário, use 3000
var PORT = process.env.PORT || process.env.NODE_PORT || 3000;

// O número da sala atual a ser criada - é incrementado quando uma nova correspondência é criada
var curRoomNum = 1;

// Iniciar servidor
var app = http.createServer(router).listen(PORT);
console.log("HTTP server started, listening on port " + PORT);


// WEBSOCKETS
// ransfira o servidor http para o socketio e salve o servidor websocket retornado
var io = socketio(app);

// Objeto que armazena todos os utilizadores  conectados
var users = {};

// Array que armazena utilizadores  atualmente aguardando por uma conexão
// Se tiver> 1 utilizadores , uma nova sala de jogos será criada
var userQueue = [];

// Uma lista de todos os nossos GameManagers - os jogos atualmente em execução
var currentGames = [];

/* createGame()
desc: cria um novo jogo dos dois primeiros utilizadores  na fila
*/
function createGame() {
	// cria a string para um novo nome de sala
// dois jogadores entram na nova sala e são passados para um GameManager
	var roomName = "room" + curRoomNum;
	
	// incremento do número da sala para que nenhum utilizador  possa entrar nesta sala novamente
	++curRoomNum;
	
	// adiciona os dois utilizadores  à próxima sala do ciclo - eles estão sozinhos, prontos para o jogo!
	userQueue[0].roomName = roomName;
	userQueue[1].roomName = roomName;
	userQueue[0].join(roomName);
	userQueue[1].join(roomName);
	

// cria a nova instância do jogo
	var newGame = new GameManager(roomName, io, userQueue[0], userQueue[1]);
	currentGames.push(newGame);
	
	// limpe esses dois utilizadores  da fila
	userQueue.splice(0, 2);
}

/* cleanGames()
desc: verifica os jogos para encontrar os terminados e eliminá-los
*/
function cleanGames() {
	for (var i = 0; i < currentGames.length; ++i) {
		// pegue um atual
		var curr = currentGames[i];
		
	
// apaga o jogo da lista se completo
// apenas para poupar memória, para que jogos antigos não permaneçam na lista
		if (curr.gameComplete) {
			currentGames.splice(currentGames.indexOf(curr), 1);
		}
	}
}
// Entrada de utilizador   - emitido após um socket ser concluído e processado

var onJoined = function(socket) {
	
	socket.on ("join", function(data) {
		
	
		// verifique se um utilizador  com esse nome já existe
		if (users[data.name]) {
			socket.emit("msg", { msg: "Esse nome já está a ser usado. Escolhe outro." });
			return;
		}
		// armazena o nome de utilizador no socket para uso futuro
	
		socket.name = data.name;
			
		// armazena o utilizador no banco de dados para referência futura
		users[data.name] = socket.name;
		
	
		// adicionar utilizador à fila do utilizador, userQueue
		userQueue.push(socket);

		// notifica o utilizador que ele está espera por outra conexão
		socket.emit("msg", { msg: "Estamos a procurar um jogador par ti... Aguarda..." });
		
		// diz ao cliente que o registro foi enviado
		socket.emit("joinSuccess");
		
		// tenta criar uma nova sala de jogos se tivermos dois utilizadores na fila
		if (userQueue.length >= 2) {	
			createGame();
		}
	});
};

// User disconnect - emitido quando um utilizador se desconecta, finaliza o jogo e informa ao outro utilizador
var onDisconnect = function(socket) {
	
	//  eventos de desconexão
	socket.on("disconnect", function(data) {

		// apaga o utilizador da lista de utilizadores
		delete users[socket.name];
		
		// apaga o utilizador da fila
		delete userQueue[socket.name];
	});
};


io.sockets.on("connection", function(socket) {
	
	onJoined(socket);
	onDisconnect(socket);
});

console.log("Websocket server started");

// inicia um loop para limpar jogos vazios
setInterval(cleanGames, 1000);
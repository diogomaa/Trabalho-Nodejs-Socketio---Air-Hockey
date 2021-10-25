
"use strict"; 


class GameManager {

	constructor(room, io, p1, p2) {
		this.room = room;
		this.io = io;	
		this.p1 = p1;
		this.p2 = p2;
		
	// == Variáveis gerais do jogo == //
// variáveis de tamanho da sala de jogos codificadas com base na tela enviadas aos clientes
		this.gW = 1280;	// largura do jogo
		this.gH = 800;	// altura do jogo
		
		// variáveis de controle
		this.gameComplete = false;		// ativado quando o jogo é concluído, o servidor verifica e elimina o gerenciador
		this.gameActive = false;		// se a física do jogo é simulada ou não
		
		
		// == Objetos de jogo == //
// cria o disco com seus valores iniciais padrão
		this.puck = {
			pos: {
				x: this.gW/2,
				y: this.gH/2
			},
			vel: {
				x: 0,
				y: 0
			},
			radius: 25
		};
		
		// codifique um valor para o raio das paddles=discos do jogador
		this.p1.radius = this.p2.radius = 50;
		
		// define a pontuação de cada jogador
		this.p1.score = this.p2.score = 0;
		
		// passa cada utilizador para o retorno de chamada principal da atualização
		this.onUpdate(p1);
		this.onUpdate(p2);
		
		// definir utilizadores para suas posições iniciais
		this.p1.pos = {
			x: this.gW * 0.75,
			y: this.gH/2
		};
		this.p2.pos = {
			x: this.gW * 0.25,
			y: this.gH/2
		};
		
		// emite as posições dos utilizadores

		// diz aos utilizadores que o jogo começou
		this.io.sockets.in(this.room).emit("beginPlay");
	
		/* atualize as informações do jogador 1:
			- diga-lhes o nome do jogador 2
			- dê a eles uma bela mensagem de partida
			*/
		this.p1.emit(
			"updateInfo",
			{
				object: "otherUser",
				username: this.p2.name
			}
		);
		this.p1.emit(
			"msg",
			{
				msg: "O jogo começou, estas a jogar contra " + this.p2.name + "."
			}
		);
		this.p1.side = 0;
		
		
		/* atualiza as informações do jogador 2:
		- diga-lhes o nome do jogador 1
		- diga-lhes que são o jogador 2 (lado 1)
		-mensagem de partida
		*/
		this.p2.emit(
			"updateInfo",
			{
				object: "otherUser",
				username: this.p1.name
			}
		);
		this.p2.emit(
			"msg",
			{
				msg: "O jogo começou, estas a jogar contra " + this.p1.name + "."
			}
		);
		this.p2.emit("updateInfo", { object: "user", side: 1 });
		this.p2.side = 1;
	
	
		// == A sequência inicial do jogo
		this.notifyUsersMultiple(["Quem fizer 10 pontos ganha","Jogo começa em 3...", "2...", "1...", "Vai!"], 2000);
		this.activateGame(5000);
	}

	// Callback atualização do utilizador - emitido por cada socket a cada tick, a posição é enviada para outro utilizador
	onUpdate(socket) {
		socket.on("update", function(data) {
			if (socket.pos) {
				socket.prevPos = socket.pos;
			}
			else {
				socket.prevPos = data.pos;
			}
			
			socket.pos = data.pos;
			socket.broadcast.to(socket.roomName).emit("updateInfo", { object: "otherUser", pos: data.pos, time: new Date().getTime() });
		});
	}
	
	/* notifyUsers
desc: envia uma notificação para os utilizadores, que aparece na tela do jogo
@msg: a mensagem para exibir aos utilizadores
@duração: a duração que a mensagem deve exibir para
@delay: permite um atraso antes de enviar a mensagem, para pré-agendar mensagens
*/
	notifyUsers(msg, duration) {
		this.io.sockets.in(this.room).emit("notify", { msg: msg, duration: duration });
	}
	
	/* notifyUsersMultiple
	desc: envia uma série de notificações para os utilizadores, que aparecem na tela do jogo em sequência
	@msgs: um arry de mensagens para exibir aos utilizadores
	@duração: a duração que cada mensagem deve exibir para
	*/
	notifyUsersMultiple(msgs, duration) {
		for (var i = 0; i < msgs.length; ++i) {
			setTimeout(this.notifyUsers.bind(this), i*duration, msgs[i], duration);
		}
	}
			
	/* activateGame
desc: ativa o jogo (ativa a física) após um período de tempo
@delay: número de carrapatos após o qual ativar
*/
	activateGame(delay) {
		setTimeout(function() {
			setInterval(this.update.bind(this), 1000/120);
			this.gameActive = true;
		}.bind(this), delay);
	}
	
/* deactivateGame()
desc: desativa o jogo (desativa a atualização física)
*/
	deactivateGame() {
		this.gameActive = false;
	}
	
	/* distance()
desc: obtém a distância entre dois objetos do jogo (dos três, DISCO e dois paddles)
@ obj1: o primeiro objeto a comparar
@ obj2: o segundo objeto para comparar
*/
	distance(obj1, obj2) {
		return Math.sqrt(Math.pow(obj2.pos.x - obj1.pos.x, 2) + Math.pow(obj2.pos.y - obj1.pos.y, 2));
	}
	
	/* pointDistance()
desc: obtém a distância entre dois objetos formatados {x, y}
@ obj1: o primeiro objeto a comparar
@ obj2: o segundo objeto para comparar
*/
	pointDistance(obj1, obj2) {
		return Math.sqrt(Math.pow(obj2.x - obj1.x, 2) + Math.pow(obj2.y - obj1.y, 2));
	}
	
	/* vecSubtract()
desc: retorna o vetor normalizado de obj1 para obj2
*/
	vecSubtract(obj1, obj2) {
		// cria o vetor entre eles
		var vec = {
			x: obj2.pos.x - obj1.pos.x,
			y: obj2.pos.y - obj1.pos.y
		};
		
		// obtém a distância entre esses objetos
		var dist = this.distance(obj1, obj2);
		
		// normalize o vetor
		vec.x /= dist;
		vec.y /= dist;
		
		return vec;
	}
	
	/* update()----CEREBRO DO JOGO----
	desc: atualiza a física do jogo
	*/
	update() {
		if (this.gameActive) {
			// onde irá armazenar a velocidade adicional do disco, caso precise de atualização
			var newPuckVel = {
				x: 0,
				y: 0
			};
			
			// a velocidade de impulso adicionada por cada jogador, se houver
			var p1Impulse, p2Impulse;
			var spd;
			
			//tentar adicionar impulsos do jogador 1
			if (this.distance(this.p1, this.puck) < this.p1.radius + this.puck.radius) {
				// obtém a velocidade do jogador comparando sua posição com a posição anterior
				spd = this.pointDistance(this.p1.prevPos, this.p1.pos);
				
				// pegue o vetor direcional apontando para o disco (o impulso está nessa direção)
				p1Impulse = this.vecSubtract(this.p1, this.puck);
				
				// multiplica o vetor direcional pela velocidade do utilizador
				p1Impulse.x *= Math.min(1.75, 1 + Math.pow(spd, 1/5));
				p1Impulse.y *= Math.min(1.75, 1 + Math.pow(spd, 1/5));
				
				// adiciona isso à nova velocidade geral
				newPuckVel.x += p1Impulse.x;
				newPuckVel.y += p1Impulse.y;
			}
			
			// tenta adicionar impulsos do jogador 1
			if (this.distance(this.p2, this.puck) < this.p2.radius + this.puck.radius) {
				// obtém a velocidade do jogador comparando sua posição com a posição anterior
				spd = this.pointDistance(this.p2.prevPos, this.p2.pos);
				
				// pegue o vetor direcional apontando para o disco (o impulso está nessa direção)
				p2Impulse = this.vecSubtract(this.p2, this.puck);
				
				// multiplica o vetor direcional pela velocidade do utilizador
				p2Impulse.x *= Math.min(1.75, 1 + Math.pow(spd, 1/5));
				p2Impulse.y *= Math.min(1.75, 1 + Math.pow(spd, 1/5));
				
				// adiciona isso à nova velocidade geral
				newPuckVel.x += p2Impulse.x;
				newPuckVel.y += p2Impulse.y;
			}
			
			// imprime a nova velocidade do disco aos clients - somente se atualizado
			if (p1Impulse || p2Impulse) {
				// adiciona nossa nova velocidade ao antigo
				this.puck.vel.x += newPuckVel.x;
				this.puck.vel.y += newPuckVel.y;
			}
			
			// adiciona à posição do disco
			this.puck.pos.x += this.puck.vel.x;
			this.puck.pos.y += this.puck.vel.y;
			
			// bouncePuck tenta ressaltar o disco das paredes da sala de jogos
			this.bouncePuck();
			
		// aperta o disco dentro do campo se não estiver a entrar numa  zona de golo
			if (this.puckInGoalHeight()) {
				this.puck.pos.x = this.clamp(this.puck.pos.x, this.puck.radius, this.gW - this.puck.radius);
			}
				
			// veja se o disco entrou na baliza de alguém
			this.checkForPoint();


			// sempre amarra verticalmente
			this.puck.pos.y = this.clamp(this.puck.pos.y, this.puck.radius, this.gH - this.puck.radius);
			
			// aplica fricção ao disco
			this.puck.vel.x *= 0.9975;
			this.puck.vel.y *= 0.9975;

			// amarrar a velocidade para 0 se for baixa o suficiente
		
			if (Math.abs(this.puck.vel.x) < 0.001){
				this.puck.vel.x = 0;
			}
			if (Math.abs(this.puck.vel.y) < 0.001){
				this.puck.vel.y = 0;
			}
			
			// emite a nova informação do disco para as sockets
			this.io.sockets.in(this.room).emit("updateInfo", {
				object: "puck",
				pos: this.puck.pos,
				vel: this.puck.vel, 
				time: new Date().getTime()
			});
		}
		else {
			// move o disco de volta para o centro com velocidade 0
			this.puck.vel = { x: 0, y: 0 };
			this.puck.pos = { x: this.gW/2, y: this.gH/2 };
			
			// emite a nova informação do disco para as sockets
			this.io.sockets.in(this.room).emit("updateInfo", {
				object: "puck",
				pos: this.puck.pos,
				vel: this.puck.vel, 
				time: new Date().getTime()
			});
		}
	}
	
	/* checkForPoint()
desc: verifica se o disco está dentro de uma das balizas e, se for o caso, recompensa com um ponto
*/
	checkForPoint() {
		// verifique se o disco está dentro de uma das balizas (fora docampo)
		var goalScored = ((this.puck.pos.x < 0) || (this.puck.pos.x - this.puck.radius > this.gW));
		
		// se um golo foi marcado, determine qual lado e emite a nota de pontuação
		if (goalScored) {
			
		// verifique qual lado marcou com base na posição x do disco
			var side;
			
		// o puck está à esquerda, o jogador 1 tem o ponto
			if (this.puck.pos.x < 0) {
				side = 0;
				++this.p1.score;
			}
			// à direita, o jogador 2 marcou
			else {
				side = 1;
				++this.p2.score;
			}
			
			// desativa a física
			this.deactivateGame();
			
			// emitir a mensagem de pontuação contendo qual lado marcou
			this.io.sockets.in(this.room).emit("scorePoint", {side: side});
			
			// move o disco de volta para o centro com velocidade 0
			this.puck.vel = { x: 0, y: 0 };
			this.puck.pos = { x: this.gW/2, y: this.gH/2 };
			
			// emite a nova posição do disco para os clients
			this.io.sockets.in(this.room).emit("updateInfo", {
				object: "puck",
				pos: this.puck.pos,
				vel: this.puck.vel
			});
			
			// se a pontuação de um dos jogadores for> = 10, eles ganham
			if (this.p1.score >= 10 || this.p2.score >= 10) {
				this.notifyUsersMultiple(["Jogo Terminado."," Parabéns aos participantes."], 2000);
				this.gameComplete = true;
			}
			// ninguém ganhou, continue
			else {
				//enviar um resumo para os jogadores
				this.notifyUsersMultiple(["Continua em 3...", "2...", "1...", "Vai!"], 500);
				this.activateGame(2000);
			}
		}
	}
	
	/* bouncePuck()
desc: verifica a posição do disco e o joga fora das paredes
*/
	bouncePuck() {
		// saltar para a esquerda para a direita
		if ((this.puck.pos.x - this.puck.radius < 0) || (this.puck.pos.x + this.puck.radius > this.gW)) {
			// apenas saltar fora da parede se não estiver entrando em uma zona de golo
			if (this.puckInGoalHeight()) {
				this.puck.vel.x *= -1;
			}
		}
		
		// saltar de cima para baixo
		if ((this.puck.pos.y - this.puck.radius < 0) || (this.puck.pos.y + this.puck.radius > this.gH)) {
			this.puck.vel.y *= -1;
		}
	}
			
// Uma função auxiliar usada principalmente para o disco
// Retorna o valor preso dentro de min e max
	clamp(val, min, max) {
		return Math.max(min, Math.min(val, max));
	}
	
	// Um ajudante que verifica se o disco está dentro da faixa de y de um golo
	puckInGoalHeight() {
		return (this.puck.pos.y < this.gH*0.35 || this.puck.pos.y > this.gH*0.65);
	}
}

// Exporta a classe como um módulo
module.exports = GameManager;
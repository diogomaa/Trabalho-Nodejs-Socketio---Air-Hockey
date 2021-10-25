// REQUIRES
var fs = require("fs");					// file system

// lê os requires client files para a memoria
var index = fs.readFileSync(__dirname + "/../client/client.html");
var backgroundImg = fs.readFileSync(__dirname + "/../media/field.png");
var userPaddleImg = fs.readFileSync(__dirname + "/../media/user2.png");
var enemyPaddleImg = fs.readFileSync(__dirname + "/../media/user1.png");
var puckImg = fs.readFileSync(__dirname + "/../media/disc.png");


//Determina como encaminhar route users - só aceita GET requests  por enquanto
var router = function(request, response) {
// se eles pedirem a root, prepare e escreva a página de index até ao header

	switch (request.url) {
		case '/':
			response.writeHead(200, {"Content-Type": "text/html"});	
			response.write(index);
			break;
		case '/favicon.ico':
			break;
		case '/media/field.png':
			response.writeHead(200, {"Content-Type": "image/gif"});
			response.write(backgroundImg);
			break;
		case '/media/user2.png':
			response.writeHead(200, {"Content-Type": "image/gif"});
			response.write(userPaddleImg);
			break;
		case '/media/user1.png':
			response.writeHead(200, {"Content-Type": "image/gif"});
			response.write(enemyPaddleImg);
			break;
		case '/media/disc.png':
			response.writeHead(200, {"Content-Type": "image/gif"});
			response.write(puckImg);
			break;
	}
	
	// fecha response stream
	response.end();
};
// Exportar o main router como uma função pública
module.exports = router;
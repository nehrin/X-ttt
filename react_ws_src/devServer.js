var path = require('path');
var express = require('express');
var webpack = require('webpack');
var http = require('http'); // <-- Added for Socket.IO
var socketIo = require('socket.io'); // <-- Import Socket.IO
var config = require('./webpack.config.dev');

var app = express();
var server = http.createServer(app); // <-- Create HTTP server
var io = socketIo(server, {
  cors: {
    origin: "*", // Adjust this for security
    methods: ["GET", "POST"],
  },
});

var userNamespace = io.of("/user"); // <-- Create a namespace for user connections

var compiler = webpack(config);

app.use(require('webpack-dev-middleware')(compiler, {
	noInfo: true,
	publicPath: config.output.publicPath
}));

app.use(require('webpack-hot-middleware')(compiler));

// Update the proxy URL to a valid hostname or IP address and port
var proxy = require('proxy-middleware');
var url = require('url');
app.use('/images', proxy(url.parse('http://z2/projs/kisla/X-react-starter/dev/WS/images')));

app.get('*', function(req, res) {
	res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

var players = []; // Array to store connected players

// SOCKET.IO HANDLING
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("message", (msg) => {
    console.log("Received message:", msg);
    io.emit("message", msg); // Broadcast message to all clients
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    // Remove player from the list
    players = players.filter(player => player.id !== socket.id);
  });

  socket.on('joinPlayer', (playerName) => {
    // Store player info
    socket.playerName = playerName;
    players.push({ id: socket.id, name: playerName });

    // Emit to all clients that a player joined
    io.emit('player_joined', {
      name: playerName
    });

    // Pair players if there are at least two players
    if (players.length >= 2) {
      const player1 = players[0];
      const player2 = players[1];

      // Assign symbols to players
      player1.symbol = 'x';
      player2.symbol = 'o';

      // Emit pair_players event to both players
      io.to(player1.id).emit('pair_players', { opp: player2, mode: 'm', symbol: player1.symbol });
      io.to(player2.id).emit('pair_players', { opp: player1, mode: 'o', symbol: player2.symbol });

      // Remove paired players from the list
      players = players.slice(2);
    }
  });

  socket.on('ply_turn', (data) => {
    // Find the opponent
    const opponent = players.find(player => player.id !== socket.id);
    if (opponent) {
      // Emit the turn to the opponent with turn data
      io.to(opponent.id).emit('opp_turn', {
        cell_id: data.cell_id,
        symbol: data.symbol,
        your_turn: true
      });
      // Emit turn update to current player
      io.to(socket.id).emit('turn_update', { your_turn: false });
    }
  });
});

// Namespace handling for user connections
userNamespace.on("connection", (socket) => {
  console.log("A user connected to user namespace:", socket.id);

  socket.on("joinPlayer", (playerName) => {
    console.log(`${socket.id} joined player: ${playerName}`);
    socket.join(playerName); // Join the room with the player name
  });

  socket.on("privateMessage", (msg) => {
    console.log("Received private message:", msg);
    userNamespace.to(msg.playerName).emit("privateMessage", msg); // Send message to specific player room
  });

  socket.on("disconnect", () => {
    console.log("User disconnected from user namespace:", socket.id);
  });
});

// Use server.listen instead of app.listen
server.listen(3000, '0.0.0.0', function(err) {
	if (err) {
		console.log(err);
		return;
	}
	console.log('Listening at http://0.0.0.0:3000');
});

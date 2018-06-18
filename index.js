var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.get('/', function(req, res){
  // res.send('<h1>Hello world</h1>');
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', function(socket){
  console.log('a user connected');
  io.emit('chat message', 'an user has been connected');

  socket.on('add user', function(username) {
    socket.username = username;
  });

  socket.on('chat message', function(msg){
    console.log('message: ' + msg + " (" + socket.username + ")");
    socket.broadcast.emit('chat message', '<strong>' + socket.username + ":</strong> " + msg);
  });

  socket.on('disconnect', function(){
    console.log('user disconnected' + " (" + socket.username + ")");
    io.emit('chat message', 'an user has been disconnected' + " (" + socket.username + ")");
  });  
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});
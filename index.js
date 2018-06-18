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

  socket.on('chat message', function(msg){
    console.log('message: ' + msg);
    socket.broadcast.emit('chat message', msg);
  });

  socket.on('disconnect', function(){
    console.log('user disconnected');
    io.emit('chat message', 'an user has been disconnected');
  });  
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});
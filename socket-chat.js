var app = require('express')();

var http = require('http').Server(app);
var io = require('socket.io')(http);

app.get('/socket.io', function(req, res){
  // res.send('<h1>Hello world</h1>');
  res.sendFile(__dirname + '/index.html');
});

var adminSocket;
io.on('connection', function(socket){
  socket.username = 'anonymous_' + socket.id;
  socket.room = 'room_' + socket.username;
  socket.admin = false;

  console.log('an user connected: ' + socket.id);
  io.emit('connected', 'an user has been connected: ' + socket.username);

  socket.on('add user', function(data) {
    socket.username = data.username;
    socket.room = 'room##' + data.username + '##' + data.email;    

    if (data.username == 'admin' && data.email == 'lele') {
      socket.admin = true;
      console.log('admin logged in: ' + socket.username + " (" + socket.room + ")");
      adminSocket = socket.id;
      socket.emit('authenticated', io.sockets.adapter.rooms);
    } else {
      socket.join(socket.room);
      socket.emit('room joined', socket.room);

      console.log('username changed: ' + socket.username + " (" + socket.room + ")");      
      socket.to(adminSocket).emit('authenticated', io.sockets.adapter.rooms);
    }
    console.log('admin socket: ' + adminSocket);
  });

  socket.on('chat message', function(msg){
    console.log('message: ' + msg + " (" + socket.room + ': ' + socket.username + ')');
    socket.to(socket.room).emit('chat message', {msg: msg, username: socket.username});
  });

  socket.on('change room', function(room){
    if (socket.admin){
      socket.leave(socket.room);
      socket.room = room;
      socket.join(socket.room);
      socket.emit('room joined', socket.room);

    } else {
      socket.emit('unauthenticated', 'Only admin can change room!');
    }
  });

  socket.on('disconnect', function(){
    console.log('user disconnected' + " (" + socket.username + ")");
    io.emit('disconnected', 'an user has been disconnected: ' + socket.username);
  });  
});

http.listen(6001, function(){
  console.log('listening on *:6001');
});

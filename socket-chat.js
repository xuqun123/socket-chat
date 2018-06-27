//initialize express, server and socket.io
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var moment = require('moment');
require('dotenv').config();

//connect to DB
var mysql = require('mysql')
var connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  charset : 'utf8mb4'
});
connection.connect(function(err) {
  if (err) 
    console.log(err);
  console.log('You are now connected to DB...');
});

app.get('/socket.io', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

//socket io connection
var adminSocket;
io.on('connection', function(socket){
  socket.username = 'anonymous_' + socket.id;
  socket.room = 'room##' + socket.username;
  socket.admin = false;

  console.log('an user connected: ' + socket.id);
  io.emit('connected', socket.username + 'has been connected');

  socket.on('add user', function(data) {
    socket.username = data.username;
    socket.email = data.email;
    socket.room = 'room##' + data.username + '##' + data.email;    

    if (data.username === process.env.ADMIN_USERNAME && data.email === process.env.ADMIN_EMAIL) {
      socket.admin = true;
      console.log('admin logged in: ' + socket.username + " (" + socket.room + ")");
      adminSocket = socket.id;
      socket.emit('authenticated', io.sockets.adapter.rooms);
      socket.broadcast.emit('admin online', 'Quintin is online');
    } else {
      socket.join(socket.room);
      socket.emit('room joined', {username: socket.username, room: socket.room});

      console.log('general user logged in: ' + socket.username + " (" + socket.room + ")");      
      if (adminSocket != null && adminSocket != undefined) {
        socket.emit('admin online', 'Quintin is online');
        socket.to(adminSocket).emit('authenticated', io.sockets.adapter.rooms);
        socket.to(adminSocket).emit('room joined', {username: socket.username, room: socket.room});
      }
    }
    // console.log('admin socket: ' + adminSocket);
  });

  socket.on('chat message', function(msg){
    console.log('message: ' + msg + " (" + socket.room + ': ' + socket.username + ')');
    socket.to(socket.room).emit('chat message', {msg: msg, username: socket.username});

    var query = 'INSERT INTO messages (username, email, body, is_admin, room, created_at) VALUES ("' 
                      + socket.username + '", "' + socket.email + '", "'  
                      + msg + '", "' + (socket.admin === true ? 1 : 0) + '", "' 
                      + socket.room + '", "' +  moment().utc().format('YYYY-MM-DD HH:mm:ss') + '");';
    console.log(query);
    connection.query(query,  function (error, rows) {
      if (error)
        console.log(error);
    });
  });

  socket.on('change room', function(room){
    if (socket.admin){
      socket.to(socket.room).emit('room left', {username: socket.username, room: socket.room});
      socket.emit('room left', {username: socket.username, room: socket.room});
      socket.leave(socket.room);
      console.log('admin left room: ' + socket.room);

      socket.room = room;

      socket.join(socket.room);
      socket.to(socket.room).emit('room joined', {username: socket.username, room: socket.room});
      socket.emit('room joined', {username: socket.username, room: socket.room});

      console.log('admin changed room to: ' + socket.room);
    } else {
      socket.emit('unauthenticated', 'Only admin can change room!');
      console.log('a non-admin is try to change room: ' + socket.username);
    }
  });

  socket.on('disconnect', function(){
    if (socket.id === adminSocket) {
      console.log('admin disconnected: ' + socket.username + " (" + socket.room +  ")");
      adminSocket = null;
      socket.broadcast.emit('admin offline', 'Quintin is offline');
    } else {
      console.log('user disconnected: ' + socket.username + " (" + socket.room +  ")");
      socket.to(socket.room).emit('room left', {username: socket.username, room: socket.room});
      socket.to(adminSocket).emit('room left', {username: socket.username, room: socket.room});
    }    
  });  

  socket.on('typing', function(msg){
    socket.to(socket.room).emit('typing', msg);    
  });

  socket.on('typing stopped', function(msg){
    socket.to(socket.room).emit('typing stopped', msg);    
  });
});

http.listen(6001, function(){
  console.log('listening on *:6001');
});

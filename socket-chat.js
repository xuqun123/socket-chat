//initialize express, server and socket.io
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var moment = require('moment');
require('dotenv').config();
const SocketIOFile = require('socket.io-file');

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

app.get('/socket.io-file-client.js', (req, res, next) => {
  return res.sendFile(__dirname + '/node_modules/socket.io-file-client/socket.io-file-client.js');
});

app.use('/data', express.static('data'));

//socket io connection
var adminSocket;
io.on('connection', function(socket){
  socket.username = 'anonymous_' + socket.id;
  socket.room = 'room##' + socket.username;
  socket.admin = false;

  console.log('an user connected: ' + socket.id);
  socket.to(adminSocket).emit('connected', socket.id + ' is connected');

  socket.on('add user', function(data) {
    socket.username = data.username;
    socket.email = data.email;
    socket.room = 'room##' + data.username + '##' + data.email;    

    if (data.username === process.env.ADMIN_USERNAME && data.email === process.env.ADMIN_EMAIL) {
      socket.admin = true;
      console.log('admin logged in: ' + socket.username + " (" + socket.room + ")");
      adminSocket = socket.id;
      socket.emit('authenticated', io.sockets.adapter.rooms);
      io.emit('admin online', 'Quintin is online');
    } else {
      socket.join(socket.room);
      socket.emit('room joined', {username: socket.username, room: socket.room});

      console.log('general user logged in: ' + socket.username + " (" + socket.room + ")");      
      if (adminSocket != null && adminSocket != undefined) {
        io.emit('admin online', 'Quintin is online');
        socket.to(adminSocket).emit('authenticated', io.sockets.adapter.rooms);
        socket.to(adminSocket).emit('room joined', {username: socket.username, room: socket.room, info_only: true});
      }
    }
    // console.log('admin socket: ' + adminSocket);
  });

  socket.on('chat message', function(msg){
    var chatTime = moment().utc().format('YYYY-MM-DD HH:mm:ss');
    console.log('message: ' + msg + " (" + socket.room + ': ' + socket.username + ')');
    socket.to(socket.room).emit('chat message', {msg: msg, username: socket.username, created_at: chatTime, is_admin: socket.admin === true ? 1 : 0});

    var query = 'INSERT INTO messages (username, email, body, is_admin, room, created_at) VALUES ("' 
                      + socket.username + '", "' + socket.email + '", "'  
                      + msg + '", "' + (socket.admin === true ? 1 : 0) + '", "' 
                      + socket.room + '", "' +  chatTime + '");';
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
      socket.to(socket.room).emit('room joined', {username: socket.username, room: socket.room, info_only: true});
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
      socket.to(socket.room).emit('room left', {username: socket.username, room: socket.room, info_only: true});
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

  var uploader = new SocketIOFile(socket, {
        // uploadDir: {     // multiple directories
        //  music: 'data/music',
        //  document: 'data/document'
        // },
        uploadDir: 'data',              // simple directory
        // accepts: ['audio/mpeg', 'audio/mp3'],   // chrome and some of browsers checking mp3 as 'audio/mp3', not 'audio/mpeg'
        maxFileSize: 4194304,             // 4 MB. default is undefined(no limit)
        chunkSize: 10240,             // default is 10240(1KB)
        transmissionDelay: 0,           // delay of each transmission, higher value saves more cpu resources, lower upload speed. default is 0(no delay)
        overwrite: true               // overwrite file if exists, default is true.
    });
    uploader.on('start', (fileInfo) => {
        console.log('Start uploading');
        console.log(fileInfo);
    });
    uploader.on('stream', (fileInfo) => {
        console.log(`${fileInfo.wrote} / ${fileInfo.size} byte(s)`);
    });
    uploader.on('complete', (fileInfo) => {
        console.log('Upload Complete.');
        console.log(fileInfo);
        socket.broadcast.emit('upload completed', fileInfo);
    });
    uploader.on('error', (err) => {
        console.log('Error!', err);
    });
    uploader.on('abort', (fileInfo) => {
        console.log('Aborted: ', fileInfo);
    });  
});

http.listen(6001, function(){
  console.log('listening on *:6001');
});

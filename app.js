const express=require('express');
const app=express();
const http=require('http');
const path=require('path');
const socketIo=require('socket.io');
const server=http.createServer(app);
const io=socketIo(server);
const indexRouter=require("./routes/index");
const { log } = require('console');


app.set('view engine','ejs');
app.use(express.static(path.join(__dirname,"public")));
app.use(express.urlencoded({extended:true}));
app.use(express.json());

let waitingUser=[];
let rooms={};



io.on("connection",function(socket)
{
  socket.on("joinroom",function()
{
    if(waitingUser.length>0)
    {
      const partner= waitingUser.shift();
      const roomname=`${socket.id}-${partner.id}`;
      socket.join(roomname);
      partner.join(roomname);
io.to(roomname).emit("joined",roomname);
    }
    else
    {
        waitingUser.push(socket);
    }
}) 

socket.on("signalingMessage",function(data)
{
        socket.broadcast.to(data.room).emit("signalingMessage",data.message);
})


socket.on("message",function(data)
{
    socket.broadcast.to(data.room).emit("message",data.message);
})

socket.on("startVideoCall",function({room})
{
 socket.broadcast.to(room).emit("incomingCall");
});

socket.on("acceptCall",function({room})
{
    socket.broadcast.to(room).emit("callAccepted");
});

socket.on("rejectCall",function({room})
{
    socket.broadcast.to(room).emit("callRejected");
})

socket.on("disconnect",function()
{
    let index=waitingUser.findIndex((waitinguser) => waitinguser.id===socket.id); 
    waitingUser.splice(index,1);
})
});



app.use("/",indexRouter);

server.listen(3000);
const express=require('express');
const http=require('http');
const {Server}=require('socket.io');
const fs=require('fs');
const path=require('path');

const app=express();
const server=http.createServer(app);
const io=new Server(server,{cors:{origin:false}});
app.use(express.json({limit:'32kb'}));
app.use(express.static(path.join(__dirname,'public')));

const DB=path.join(__dirname,'data.json');
let db={players:{},igrogramMessages:{}};
try{
  if(fs.existsSync(DB)) db={...db,...JSON.parse(fs.readFileSync(DB,'utf8'))};
}catch(e){console.error('Could not read data.json:',e.message);}
if(!db.players) db.players={};
if(!db.igrogramMessages) db.igrogramMessages={};
function save(){
  try{fs.writeFileSync(DB,JSON.stringify(db,null,2));}
  catch(e){console.error('Database save failed:',e.message);}
}
function clean(value,max=40){
  return String(value||'').replace(/[<>\\u0000-\\u001f]/g,'').trim().slice(0,max);
}
const chatIds=new Set(['saved','news','alex','dev','maria']);
function validChat(id){return typeof id==='string'&&(/^[a-z0-9_-]{1,48}$/i).test(id);}
function getMessages(id){if(!Array.isArray(db.igrogramMessages[id]))db.igrogramMessages[id]=[];return db.igrogramMessages[id];}

app.get('/api/igrogram/health',(req,res)=>res.json({ok:true,service:'IGROgram',realtime:true}));
app.get('/api/igrogram/chats',(req,res)=>res.json([
  {id:'saved',name:'Избранное',avatar:'★',color:'#6da9d3',type:'personal',description:'Сохранённые сообщения'},
  {id:'news',name:'IGROgram Новости',avatar:'I',color:'#4f9bce',type:'groups',description:'Объявления проекта'},
  {id:'alex',name:'Алексей',avatar:'А',color:'#d58b75',type:'personal',description:'Личный чат'},
  {id:'dev',name:'Разработка',avatar:'💻',color:'#8c83c7',type:'groups',description:'Обсуждение разработки'},
  {id:'maria',name:'Мария',avatar:'М',color:'#c77da5',type:'personal',description:'Личный чат'}
]));
app.get('/api/igrogram/messages/:chatId',(req,res)=>{
  const id=req.params.chatId;
  if(!validChat(id))return res.status(400).json({error:'Invalid chat id'});
  res.json(getMessages(id).slice(-200));
});

// Existing Brawl Arena API — preserved.
app.get('/api/leaderboard',(req,res)=>res.json(Object.values(db.players).sort((a,b)=>b.trophies-a.trophies).slice(0,10)));
app.post('/api/admin/grant',(req,res)=>{
  if(!process.env.ADMIN_KEY||req.headers['x-admin-key']!==process.env.ADMIN_KEY)return res.status(403).json({error:'Forbidden'});
  const {playerId,gems=0,coins=0}=req.body||{};
  if(!playerId)return res.status(400).json({error:'playerId required'});
  const p=player(playerId);
  p.gems+=Math.max(0,Number(gems)||0);p.coins+=Math.max(0,Number(coins)||0);save();
  res.json({ok:true,player:p});
});
function player(id,name){
  if(!db.players[id])db.players[id]={id,name:(name||'Player').slice(0,18),gems:0,coins:100,trophies:0,x:Math.random()*700+50,y:Math.random()*400+50};
  return db.players[id];
}

io.on('connection',socket=>{
  // Existing Brawl Arena realtime events — preserved.
  const p=player(socket.id,socket.handshake.auth?.name);
  socket.emit('init',{self:p,players:Object.values(db.players)});
  socket.broadcast.emit('joined',p);
  socket.on('move',pos=>{p.x=Math.max(0,Math.min(900,Number(pos.x)||0));p.y=Math.max(0,Math.min(600,Number(pos.y)||0));socket.broadcast.emit('moved',{id:p.id,x:p.x,y:p.y});});
  socket.on('shoot',()=>socket.broadcast.emit('shot',{id:p.id,x:p.x,y:p.y}));
  socket.on('training',()=>{p.coins+=20;p.trophies+=1;save();socket.emit('reward',{coins:p.coins,trophies:p.trophies});io.emit('score',{id:p.id,coins:p.coins,trophies:p.trophies});});

  // IGROgram realtime chat.
  socket.on('igro:join',payload=>{
    const chatId=clean(payload?.chatId,48);
    if(!validChat(chatId))return;
    socket.join('igro:'+chatId);
    socket.emit('igro:history',{chatId,messages:getMessages(chatId).slice(-200)});
  });
  socket.on('igro:leave',payload=>{
    const chatId=clean(payload?.chatId,48);
    if(validChat(chatId))socket.leave('igro:'+chatId);
  });
  socket.on('igro:send',payload=>{
    const chatId=clean(payload?.chatId,48);
    const text=clean(payload?.text,4000);
    const senderId=clean(payload?.senderId,80);
    const senderName=clean(payload?.senderName,32)||'Пользователь';
    if(!validChat(chatId)||!text||!senderId)return;
    const message={id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),chatId,senderId,senderName,text,createdAt:new Date().toISOString()};
    const messages=getMessages(chatId);
    messages.push(message);
    if(messages.length>500)messages.splice(0,messages.length-500);
    save();
    io.to('igro:'+chatId).emit('igro:message',message);
  });
  socket.on('disconnect',()=>{
    delete db.players[socket.id];save();io.emit('left',socket.id);
  });
});

const port=process.env.PORT||3000;
server.listen(port,'0.0.0.0',()=>console.log('IGROgram + Brawl Arena server running on '+port));

const $=s=>document.querySelector(s);
const DEFAULT_CHATS=[
{id:'saved',name:'Избранное',avatar:'★',color:'#6da9d3',type:'personal',msg:'Сохранённые сообщения',time:'',unread:''},
{id:'news',name:'IGROgram Новости',avatar:'I',color:'#4f9bce',type:'groups',msg:'Добро пожаловать в IGROgram!',time:'',unread:''},
{id:'alex',name:'Алексей',avatar:'А',color:'#d58b75',type:'personal',msg:'Личный чат',time:'',unread:''},
{id:'dev',name:'Разработка',avatar:'💻',color:'#8c83c7',type:'groups',msg:'Обсуждение разработки',time:'',unread:''},
{id:'maria',name:'Мария',avatar:'М',color:'#c77da5',type:'personal',msg:'Личный чат',time:'',unread:''}
];
let chats=DEFAULT_CHATS,active=null,socket=null;
const getId=()=>{let id=localStorage.getItem('igrogram_user_id');if(!id){id=(crypto.randomUUID?crypto.randomUUID():'u'+Date.now()+Math.random().toString(36).slice(2));localStorage.setItem('igrogram_user_id',id)}return id};
const userId=getId();
let userName=localStorage.getItem('igrogram_user_name');
if(!userName){userName=(prompt('Как вас называть в IGROgram?')||'Пользователь').trim().slice(0,32)||'Пользователь';localStorage.setItem('igrogram_user_name',userName)}
function timeOf(value){return new Date(value).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}
function connect(){
 const scheme=location.protocol==='https:'?'wss:':'ws:';
 socket=new WebSocket(scheme+'//'+location.host+'/ws');
 socket.onopen=()=>{if(active)joinActive()};
 socket.onclose=()=>{if(active)$('#chatStatus').textContent='Соединение потеряно'};
 socket.onerror=()=>{if(active)$('#chatStatus').textContent='Нет соединения'};
 socket.onmessage=e=>{
  let data;try{data=JSON.parse(e.data)}catch{return}
  if(data.type==='history'&&active&&data.chatId===active.id){$('#messages').innerHTML='<div class="day">История чата</div>';data.messages.forEach(addMessage);scrollMessages()}
  if(data.type==='message'){
   const message=data.message,chat=chats.find(c=>c.id===message.chatId);
   if(chat){chat.msg=message.text;chat.time=timeOf(message.createdAt)}
   if(active&&active.id===message.chatId){addMessage(message);scrollMessages()}else render()
  }
 };
}
function render(){
 const q=$('#search').value.toLowerCase(),tab=document.querySelector('.tab.active').dataset.tab;
 $('#list').innerHTML=chats.filter(c=>(tab==='all'||c.type===tab)&&c.name.toLowerCase().includes(q)).map(c=>`<div class="chatrow" data-id="${c.id}"><div class="avatar" style="background:${c.color}">${c.avatar}</div><div class="details"><div class="line"><span class="name">${escapeHtml(c.name)}</span><span class="time">${c.time||''}</span></div><div class="line"><span class="preview">${escapeHtml(c.msg||'Нет сообщений')}</span></div></div></div>`).join('');
 document.querySelectorAll('.chatrow').forEach(el=>el.onclick=()=>openChat(el.dataset.id));
}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function addMessage(m){
 const b=document.createElement('div');b.className='bubble'+(m.senderId===userId?' mine':'');
 const name=document.createElement('small');name.className='sender';name.textContent=m.senderId===userId?'Вы':m.senderName;
 const body=document.createElement('div');body.textContent=m.text;
 const stamp=document.createElement('span');stamp.className='stamp';stamp.textContent=timeOf(m.createdAt)+(m.senderId===userId?' ✓':'');
 b.append(name,body,stamp);$('#messages').append(b);
}
function scrollMessages(){$('#messages').scrollTop=$('#messages').scrollHeight}
function joinActive(){
 if(!socket||socket.readyState!==WebSocket.OPEN||!active)return;
 socket.send(JSON.stringify({type:'join',chatId:active.id}));
 $('#chatStatus').textContent='онлайн · Cloudflare подключён';
}
async function openChat(id){
 const next=chats.find(c=>c.id===id);if(!next)return;
 active=next;$('#chatName').textContent=active.name;$('#chatAvatar').textContent=active.avatar;$('#chatAvatar').style.background=active.color;
 $('#messages').innerHTML='<div class="day">Загрузка истории…</div>';
 $('#conversation').classList.remove('hidden');$('#list').classList.add('hidden');$('.tabs').classList.add('hidden');$('.search').classList.add('hidden');$('.top').classList.add('hidden');
 joinActive();
 try{const response=await fetch('/api/igrogram/messages/'+encodeURIComponent(id));if(!response.ok)throw Error('API');const history=await response.json();if(active?.id===id){$('#messages').innerHTML='<div class="day">История чата</div>';history.forEach(addMessage);scrollMessages()}}
 catch(e){$('#messages').innerHTML='<div class="day">Не удалось загрузить историю. Проверьте подключение к серверу.</div>'}
}
$('#back').onclick=()=>{active=null;$('#conversation').classList.add('hidden');$('#list').classList.remove('hidden');$('.tabs').classList.remove('hidden');$('.search').classList.remove('hidden');$('.top').classList.remove('hidden');render()};
$('#composer').onsubmit=e=>{e.preventDefault();const input=$('#messageInput'),text=input.value.trim();if(!text||!active)return;if(!socket||socket.readyState!==WebSocket.OPEN){$('#chatStatus').textContent='Нет соединения с сервером';return}socket.send(JSON.stringify({type:'send',chatId:active.id,text,senderId:userId,senderName:userName}));input.value=''};
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelector('.tab.active').classList.remove('active');b.classList.add('active');render()});
$('#search').oninput=render;$('#searchToggle').onclick=()=>$('#search').focus();$('#menu').onclick=()=>$('#drawer').classList.toggle('hidden');
$('#drawer').onclick=e=>{if(e.target===$('#drawer'))$('#drawer').classList.add('hidden')};
$('#drawer').querySelectorAll('button').forEach(b=>b.onclick=()=>{if(b.textContent.includes('Мой профиль')){const name=prompt('Ваше имя',userName);if(name&&name.trim()){userName=name.trim().slice(0,32);localStorage.setItem('igrogram_user_name',userName);alert('Имя сохранено')}}else if(b.textContent.includes('Настройки'))alert('Настройки аккаунта появятся в следующем обновлении.');else if(b.textContent.includes('Избранное'))openChat('saved');else alert('Этот раздел будет добавлен в следующем обновлении.');$('#drawer').classList.add('hidden')});
fetch('/api/igrogram/chats').then(r=>{if(!r.ok)throw Error();return r.json()}).then(data=>{chats=data;render()}).catch(()=>{render();$('#list').insertAdjacentHTML('afterbegin','<div class="server-warning">Сервер пока не отвечает. Сообщения не отправляются.</div>')});
connect();

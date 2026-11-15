const http = require('http');
const fs = require('fs');
const path = require('path');
const root = __dirname;
const port = Number(process.env.PORT || 3000);
const types = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json'};
http.createServer((req,res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/health') {
    res.writeHead(200, {'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'});
    return res.end(JSON.stringify({status:'ok', service:'SABLOX', version:'0.1.0', time:new Date().toISOString()}));
  }
  if (url.pathname === '/api/games') {
    res.writeHead(200, {'Content-Type':'application/json','Cache-Control':'no-store'});
    return res.end(JSON.stringify({games:[]}));
  }
  const requested = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const file = path.resolve(root, requested);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, {'Content-Type':types[path.extname(file)] || 'application/octet-stream'});
    res.end(data);
  });
}).listen(port, '0.0.0.0', () => console.log('SABLOX server listening on ' + port));

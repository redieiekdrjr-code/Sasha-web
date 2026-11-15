const CHAT_LIST = [
  { id: "saved", name: "Избранное", avatar: "★", color: "#6da9d3", type: "personal", description: "Сохранённые сообщения" },
  { id: "news", name: "IGROgram Новости", avatar: "I", color: "#4f9bce", type: "groups", description: "Объявления проекта" },
  { id: "alex", name: "Алексей", avatar: "А", color: "#d58b75", type: "personal", description: "Личный чат" },
  { id: "dev", name: "Разработка", avatar: "💻", color: "#8c83c7", type: "groups", description: "Обсуждение разработки" },
  { id: "maria", name: "Мария", avatar: "М", color: "#c77da5", type: "personal", description: "Личный чат" }
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}
function validChat(id) {
  return typeof id === "string" && /^[a-z0-9_-]{1,48}$/i.test(id);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/") return Response.redirect(url.origin + "/igrogram/", 302);
    if (url.pathname === "/api/igrogram/health") {
      return json({ ok: true, service: "IGROgram", realtime: true, storage: "Cloudflare Durable Objects SQLite" });
    }
    if (url.pathname === "/api/igrogram/chats") return json(CHAT_LIST);
    if (url.pathname.startsWith("/api/igrogram/messages/")) {
      const id = decodeURIComponent(url.pathname.split("/").pop() || "");
      if (!validChat(id)) return json({ error: "Invalid chat id" }, 400);
      const hub = env.CHAT_HUB.getByName("main");
      return json(await hub.getMessages(id));
    }
    if (url.pathname === "/ws") {
      const hub = env.CHAT_HUB.getByName("main");
      return hub.fetch(request);
    }
    if (url.pathname.startsWith("/igrogram/") || url.pathname === "/igrogram") {
      const assetUrl = new URL(request.url);
      assetUrl.pathname = url.pathname === "/igrogram" ? "/index.html" : url.pathname.slice("/igrogram".length);
      return env.ASSETS.fetch(new Request(assetUrl, request));
    }
    return new Response("Not found", { status: 404 });
  }
};

export class ChatHub {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.sql = ctx.storage.sql;
    this.sql.exec("CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, chat_id TEXT NOT NULL, created_at TEXT NOT NULL, payload TEXT NOT NULL)");
    this.sql.exec("CREATE INDEX IF NOT EXISTS messages_chat_created ON messages(chat_id, created_at)");
  }

  async getMessages(chatId) {
    const rows = this.sql.exec(
      "SELECT payload FROM messages WHERE chat_id = ? ORDER BY created_at DESC LIMIT 200",
      chatId
    ).toArray();
    return rows.reverse().map(row => JSON.parse(row.payload));
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== "/ws" || request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws, raw) {
    let data;
    try { data = JSON.parse(raw); } catch { return; }
    if (data.type === "join" && validChat(data.chatId)) {
      ws.serializeAttachment({ chatId: data.chatId });
      ws.send(JSON.stringify({ type: "history", chatId: data.chatId, messages: await this.getMessages(data.chatId) }));
      return;
    }
    if (data.type !== "send") return;
    const attachment = ws.deserializeAttachment() || {};
    const chatId = attachment.chatId;
    const messageText = String(data.text || "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 4000);
    const senderId = String(data.senderId || "").slice(0, 80);
    const senderName = String(data.senderName || "Пользователь").replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, 32) || "Пользователь";
    if (!validChat(chatId) || !messageText || !senderId) return;

    const message = {
      id: crypto.randomUUID(),
      chatId,
      senderId,
      senderName,
      text: messageText,
      createdAt: new Date().toISOString()
    };
    this.sql.exec(
      "INSERT INTO messages (id, chat_id, created_at, payload) VALUES (?, ?, ?, ?)",
      message.id, chatId, message.createdAt, JSON.stringify(message)
    );
    this.sql.exec(
      "DELETE FROM messages WHERE chat_id = ? AND id NOT IN (SELECT id FROM messages WHERE chat_id = ? ORDER BY created_at DESC LIMIT 500)",
      chatId, chatId
    );
    for (const client of this.ctx.getWebSockets(chatId)) {
      try { client.send(JSON.stringify({ type: "message", message })); } catch {}
    }
  }

  webSocketClose(ws) {
    try { ws.close(); } catch {}
  }
}

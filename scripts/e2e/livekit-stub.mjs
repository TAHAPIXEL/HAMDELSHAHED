// سرور ساختگی LiveKit (REST) برای تست‌های e2e: همه‌ی فراخوانی‌های RoomService را با 200 می‌پذیرد
import http from "node:http";

const port = Number(process.env.E2E_LK_PORT ?? 7880);
http
  .createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end("{}");
    });
  })
  .listen(port, "127.0.0.1", () => console.log(`livekit stub on ${port}`));

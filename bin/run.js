require("dotenv").config();

if (!process.env.jwtPrivateKey) {
  console.error("FATAL: jwtPrivateKey is not set. Add it to .env and restart.");
  process.exit(1);
}

const http = require("http");
const app = require("../app");

const port = parseInt(process.env.PORT, 10) || 8000;
app.set("port", port);

const server = http.createServer(app);
server.listen(port);

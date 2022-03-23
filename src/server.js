require('dotenv/config')
const express = require('express')
const cookieParser = require("cookie-parser")
const sessions = require('express-session')
const bodyParser = require('body-parser')
const cors = require('cors')
const path = require('path')
const WebSocket = require('ws')
const { accounts_monitor } = require('./models/nano_websockets')
const { deriveWallet } = require('./models/nano-wallet/wallet.js')
const http = require('http');

const FAUCET_ACCOUNT = deriveWallet().account
const SESSION_SECRET = process.env.SESSION_SECRET

const startHTTPServer = function () {

  const app = express()

  app.use(cors())
  app.options('*', cors())

  app.use(express.static(path.join(__dirname, '/views')));

  app.set('views', './src/views')

  app.set('view engine', 'ejs');

  app.use(bodyParser.text({ inflate: true, limit: '4kb', type: '*/*' }));

  //session middleware
  app.use(sessions({
    secret: SESSION_SECRET,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 365 }, // 1 year
    resave: false
  }));

  // cookie parser middleware
  app.use(cookieParser());


  const routes = require('./routes/routes');
  app.use("/", routes)
  
  const server = http.createServer(app);

  return server

}

// WebSockets Repeater
const startWSServer = function (server) {
  const wsServer = new WebSocket.Server({ clientTracking: false, noServer: true });

  let sockets = [];

  wsServer.on('listening', () => {
    console.log(`Websocket listening`)
  });

  server.on('upgrade', function (request, socket, head) {
    wsServer.handleUpgrade(request, socket, head, function (ws) {
      wsServer.emit('connection', ws, request);
      });
  });


  // Detect new websocket connections
  wsServer.on('connection', function (socket) {

    console.log("connection websocket detected")
    sockets.push(socket);

    // When receive a websocket message from client
    socket.on('message', function (msg) {

      try {

        // Check if msg is valid
        data = JSON.parse(msg)
        if ("topic" in data && data.topic == "confirmation") {

          // Start monitoring and repeat msgs for client
          console.log('Subscribed to:', FAUCET_ACCOUNT)
          accounts_monitor([FAUCET_ACCOUNT], function (res) {
            socket.send(JSON.stringify(res))
          })

        } else {
          socket.send(JSON.stringify({ error: "invalid topic" }))
        }

      } catch (err) {

        // The received message has formatting errors
        // Or we had an error in the connection
        console.error(err)
        socket.send(JSON.stringify({ error: err }))

      }

    });

    // When a socket connection is closed/disconnected, we remove the socket from the array
    socket.on('close', function () {
      console.log("closing socket")
      sockets = sockets.filter(s => s !== socket);
    });
  });
}

module.exports = { startHTTPServer, startWSServer }
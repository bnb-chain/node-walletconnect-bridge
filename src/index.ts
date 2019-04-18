import fastify from 'fastify'
import Helmet from 'fastify-helmet'
import WebSocket from 'ws'
import config from './config'
import pubsub, { cleanUpSub, cleanUpPub } from './pubsub'
import { setNotification } from './notification'
import pkg from '../package.json'

const CLIENT_PING_INTERVAL = 30 * 1000

const noop = () => {}

const app = fastify({
  logger: {
    prettyPrint: {
      colorize: false,
      levelFirst: true,
      translateTime: true
    },
    prettifier: require('pino-pretty'),
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || undefined
  }
})

app.register(Helmet)

// for container health checks
app.get('/health', (_, res) => {
  res.status(204).send()
})

app.get('/hello', (req, res) => {
  res.status(200).send(`Hello World, this is WalletConnect v${pkg.version}`)
})

app.get('/info', (req, res) => {
  res.status(200).send({
    name: pkg.name,
    description: pkg.description,
    version: pkg.version
  })
})

app.post('/subscribe', (req, res) => {
  if (!req.body || typeof req.body !== 'object') {
    res.status(400).send({
      message: 'Error: missing or invalid request body'
    })
  }

  const { topic, webhook } = req.body

  if (!topic || typeof topic !== 'string') {
    res.status(400).send({
      message: 'Error: missing or invalid topic field'
    })
  }

  if (!webhook || typeof webhook !== 'string') {
    res.status(400).send({
      message: 'Error: missing or invalid webhook field'
    })
  }

  setNotification({ topic, webhook })

  res.status(200).send({
    success: true
  })
})

const wsServer = new WebSocket.Server({ server: app.server })
const aliveSockets = new Map<WebSocket, boolean>()

app.ready(() => {
  wsServer.on('connection', (socket: WebSocket) => {
    aliveSockets.set(socket, true)
    socket.on('pong', () => {
      aliveSockets.set(socket, true)
    })
    socket.on('message', async data => {
      pubsub(socket, data)
    })
    socket.on('close', async => {
      cleanUpSub(socket)
    })
  })
})

// client ping loop
setInterval(function ping () {
  app.log.debug(`Pinging client sockets (${aliveSockets.entries.length} alive)`)
  wsServer.clients.forEach(socket => {
    if (!aliveSockets.has(socket)) {
      return socket.terminate()
    }
    aliveSockets.delete(socket)
    socket.ping(noop)
  })
  cleanUpPub()
}, CLIENT_PING_INTERVAL)

const [host, port] = config.host.split(':')
app.listen(+port, host, (err, address) => {
  if (err) throw err
  app.log.info(`Server listening on ${address}`)
})

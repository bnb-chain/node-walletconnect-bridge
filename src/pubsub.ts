import WebSocket from 'ws'
import { ISocketMessage, ISocketSub } from './types'
import { pushNotification } from './notification'

const subs: Record<string, ISocketSub[]> = {}
const pubs: Record<string, ISocketMessage[]> = {}

const setSub = function (subscriber: ISocketSub, topic: string){ 
  if (subs[topic] == null) {
    subs[topic] = [subscriber]
  } else {
    subs[topic].push(subscriber)
  }
}

const getSub = function (topic: string): ISocketSub[] { 
  return subs[topic]
}

const setPub = function (socketMessage: ISocketMessage, topic: string) { 
  if (pubs[topic] == null) {
    pubs[topic] = [socketMessage]
  } else {
    pubs[topic].push(socketMessage)
  } 
}

const getPub = function (topic: string): ISocketMessage[] { 
  return pubs[topic]
}

function socketSend (socket: WebSocket, socketMessage: ISocketMessage) {
  if (socket.readyState === 1) {
    console.log('OUT =>', socketMessage)
    socket.send(JSON.stringify(socketMessage))
  }
}

const delPub = function (topic: string) { 
  delete pubs[topic]
}

const SubController = (socket: WebSocket, socketMessage: ISocketMessage) => {
  const topic = socketMessage.topic

  const subscriber = { topic, socket }

  setSub(subscriber, topic)

  const pending = getPub(topic)

  if (pending && pending.length) {
    pending.forEach((pendingMessage: ISocketMessage) =>
      socketSend(socket, pendingMessage)
    )
    delPub(topic)
  }
}

const PubController = (socketMessage: ISocketMessage) => {
  const subscribers = getSub(socketMessage.topic)

  // send push notifications
  pushNotification(socketMessage.topic)

  if (subscribers != null) {
    subscribers.forEach((subscriber: ISocketSub) =>
      socketSend(subscriber.socket, socketMessage)
    )
  } else {
    setPub(socketMessage, socketMessage.topic)
  }
}

export default (socket: WebSocket, data: WebSocket.Data) => {
  const message: string = String(data)

  if (message) {
    if (message === 'ping') {
      if (socket.readyState === 1) {
        socket.send('pong')
      }
    } else {
      let socketMessage: ISocketMessage

      try {
        socketMessage = JSON.parse(message)

        console.log('IN  =>', socketMessage)

        switch (socketMessage.type) {
          case 'sub':
            SubController(socket, socketMessage)
            break
          case 'pub':
            PubController(socketMessage)
            break
          default:
            break
        }
      } catch (e) {
        console.error('incoming message parse error:', message, e)
      }
    }
  }
}

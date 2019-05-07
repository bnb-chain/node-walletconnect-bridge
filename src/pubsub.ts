import WebSocket from 'ws'
import { ISocketMessage, ISocketSub } from './types'
import { pushNotification } from './notification'

//Messages only last in pubs for 30 mins
const CLEANUP_INTERVAL = 30 * 60 * 1000

export const subs = new Map<string, ISocketSub[]>()
export const pubs = new Map<string, ISocketMessage[]>()

const setSub = function (subscriber: ISocketSub, topic: string){ 
  const sub = subs.get(topic)
  if (!sub) {
    subs.set(topic,[subscriber])
  } else {
    sub.push(subscriber)
    subs.set(topic,sub)
  }
}

const getSub = function (topic: string): ISocketSub[] { 
  const sub = subs.get(topic)
  if (sub) {
    return sub
  }
  return []
}

const setPub = function (socketMessage: ISocketMessage, topic: string) { 
  const pub = pubs.get(topic)
  if (!pub) {
    pubs.set(topic,[socketMessage])
  } else {
    pub.push(socketMessage)
    pubs.set(topic,pub)
  } 
}

const getPub = function (topic: string): ISocketMessage[] { 
  const pub = pubs.get(topic)
  if (pub) {
    return pub
  }
  return []
}

function socketSend (socket: WebSocket, socketMessage: ISocketMessage) {
  if (socket.readyState === 1) {
    console.log('OUT =>', socketMessage)
    socket.send(JSON.stringify(socketMessage))
  }
}

const delPub = function (topic: string) { 
  pubs.delete(topic)
}

const SubController = (socket: WebSocket, socketMessage: ISocketMessage) => {
  const topic = socketMessage.topic
  let time = Date.now() 

  const subscriber = { topic, socket, time }

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
  if (subscribers.length > 0) {
    subscribers.forEach((subscriber: ISocketSub) =>
      socketSend(subscriber.socket, socketMessage)
    )
  } else {
    socketMessage.time = Date.now()
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

export const cleanUpSub = (socket: WebSocket) => {
  for (let topic of subs.keys()) {
    let sub = subs.get(topic)
    if (sub){
      sub = sub.filter(s => s.socket !== socket)
      subs.set(topic,sub)
      if (sub.length < 1) {
        subs.delete(topic)
      }
    }
  }
}

export const cleanUpPub = () => {
  for (const [topic, pub] of pubs) {
    if (pub) {
      while (pub.length != 0) {
        if (pub[0].time < Date.now() - CLEANUP_INTERVAL) {
          pub.shift()
        } else {
          break
        }
      }
      if (pub.length < 1) {
        pubs.delete(topic)
      }
    }
  }
}

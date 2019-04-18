import WebSocket from 'ws'

export interface ISocketMessage {
  topic: string
  type: string
  payload: string
  time: number
}

export interface ISocketSub {
  topic: string
  socket: WebSocket
  time: number
}

export interface INotification {
  topic: string
  webhook: string
}

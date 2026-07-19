// Transportes do duelo. Interface única:
//   createTransport(code) → { kind, send(msg), onMessage(cb), onStatus(cb), close() }
// SupabaseTransport: canal Realtime (protocolo Phoenix sobre WebSocket), sem SDK.
// LocalTransport: BroadcastChannel — duas abas no mesmo aparelho (e testes).
import { getSupabaseConfig } from './config.js'

const HEARTBEAT_MS = 25000
const RECONNECT_BASE_MS = 800
const MAX_RECONNECT = 6

export function createTransport(roomCode) {
  const config = getSupabaseConfig()
  return config ? createSupabaseTransport(roomCode, config) : createLocalTransport(roomCode)
}

function createLocalTransport(roomCode) {
  const channel = new BroadcastChannel(`iprachute-duel-${roomCode}`)
  let messageCb = null
  let statusCb = null
  channel.onmessage = (event) => messageCb?.(event.data)
  queueMicrotask(() => statusCb?.('open'))
  return {
    kind: 'local',
    send(msg) {
      channel.postMessage(msg)
    },
    onMessage(cb) {
      messageCb = cb
    },
    onStatus(cb) {
      statusCb = cb
      cb('open')
    },
    close() {
      channel.close()
    },
  }
}

function createSupabaseTransport(roomCode, { url, key }) {
  const wsUrl = `${url.replace(/^http/, 'ws').replace(/\/$/, '')}/realtime/v1/websocket?apikey=${encodeURIComponent(key)}&vsn=1.0.0`
  const topic = `realtime:duel:${roomCode}`
  let ws = null
  let ref = 0
  let joined = false
  let closed = false
  let attempts = 0
  let heartbeatTimer = null
  let messageCb = null
  let statusCb = null
  const outbox = []

  const nextRef = () => String(++ref)

  function connect() {
    if (closed) return
    statusCb?.('connecting')
    ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      attempts = 0
      ws.send(
        JSON.stringify({
          topic,
          event: 'phx_join',
          payload: {
            config: { broadcast: { self: false, ack: false }, presence: { key: '' }, postgres_changes: [] },
          },
          ref: nextRef(),
        }),
      )
      clearInterval(heartbeatTimer)
      heartbeatTimer = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: nextRef() }))
        }
      }, HEARTBEAT_MS)
    }

    ws.onmessage = (event) => {
      let frame
      try {
        frame = JSON.parse(event.data)
      } catch {
        return
      }
      if (frame.topic !== topic) return
      if (frame.event === 'phx_reply' && frame.payload?.status === 'ok' && !joined) {
        joined = true
        statusCb?.('open')
        while (outbox.length) rawSend(outbox.shift())
        return
      }
      if (frame.event === 'broadcast' && frame.payload?.event === 'duel') {
        messageCb?.(frame.payload.payload)
      }
    }

    ws.onclose = () => {
      joined = false
      clearInterval(heartbeatTimer)
      if (closed) return
      if (attempts >= MAX_RECONNECT) {
        statusCb?.('error')
        return
      }
      attempts += 1
      statusCb?.('reconnecting')
      setTimeout(connect, RECONNECT_BASE_MS * attempts)
    }
    ws.onerror = () => {
      try {
        ws.close()
      } catch {
        /* já fechado */
      }
    }
  }

  function rawSend(msg) {
    ws.send(
      JSON.stringify({
        topic,
        event: 'broadcast',
        payload: { type: 'broadcast', event: 'duel', payload: msg },
        ref: nextRef(),
      }),
    )
  }

  connect()

  return {
    kind: 'supabase',
    send(msg) {
      if (joined && ws?.readyState === WebSocket.OPEN) rawSend(msg)
      else outbox.push(msg)
    },
    onMessage(cb) {
      messageCb = cb
    },
    onStatus(cb) {
      statusCb = cb
    },
    close() {
      closed = true
      clearInterval(heartbeatTimer)
      try {
        ws?.close()
      } catch {
        /* já fechado */
      }
    },
  }
}

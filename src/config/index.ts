const env = process.env.NODE_ENV || 'development'
const debug = env !== 'production'
const port = process.env.PORT || env === 'production' ? 5000 : 5001
const host = process.env.HOST || `0.0.0.0:${port}`
const webhookWhitelist = process.env.WHITELIST || null

export default {
  env: env,
  debug: debug,
  port,
  host,
  webhook_whitelist: webhookWhitelist
}

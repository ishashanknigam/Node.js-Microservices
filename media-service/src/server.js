require('dotenv').config()
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const mongoose = require('mongoose')
const mediaRoutes = require('./routes/media-routes')
const errorHandler = require('./middleware/errorHandler')
const logger = require('./utils/logger')
const { rateLimit } = require('express-rate-limit');
const { connectToRabbitMQ, consumeEvent } = require('./utils/rabbitmq')
const { handlePostDeleted } = require('./eventHandlers/media-event-handlers')


const app = express()
const PORT = process.env.PORT || 3003


mongoose.connect(process.env.MONGODB_URI)
  .then(() => logger.info('Connected to DB'))
  .catch((e) => logger.error('Mongo connection error', e))


app.use(cors())
app.use(helmet())
app.use(express.json())


app.use((req, res, next) => {
  logger.info(`Received ${req.method} request to ${req.url}`);
  logger.info(`Request body, ${req.body}`);
  next();
});


//ip based rate limiting for sensitive endpoints
const sensitiveEndPointsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Sensitive endpoint rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({ success: false, message: "Too many requests " });
  },
})


// apply this sensitiveEndPointsLimiter to our routes
app.use('/api/media/upload', sensitiveEndPointsLimiter)


app.use('/api/media', mediaRoutes)

app.use(errorHandler)


async function startServer() {
  try {
    await connectToRabbitMQ();

    //consum all the event
    await consumeEvent("post.deleted", handlePostDeleted)

    app.listen(PORT, () => {
      logger.info(`Media service running on port ${PORT}`)
    })
  } catch (error) {
    logger.error("Failed to connect to server.", error);
    process.exit(1);
  }
}

startServer();

//unhandled promise rejection

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at', promise, 'reason:', reason)
})
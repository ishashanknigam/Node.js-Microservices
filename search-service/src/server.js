require('dotenv').config();
const express = require('express')
const mongoose = require('mongoose')
const Redis = require('ioredis')
const cors = require('cors')
const helmet = require('helmet')
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');
const { connectToRabbitMQ, consumeEvent } = require('./utils/rabbitmq')
const { rateLimit } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis')
const searchRoutes = require('./routes/search-routes');
const { handlePostCreated, handlePostDeleted } = require('./eventHandler/search-event-handlers');


const app = express()
const PORT = process.env.PORT;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => logger.info('Connected to DB'))
  .catch((e) => logger.error('Mongo connection error', e))

const redisClient = new Redis(process.env.REDIS_URL);

//middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());

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
  store: new RedisStore({
    sendCommand: (...args) => redisClient.call(...args)
  })
})


// apply this sensitiveEndPointsLimiter to our routes
app.use('/api/posts/createPost', sensitiveEndPointsLimiter)


app.use('/api/search', searchRoutes)

app.use(errorHandler)


async function startServer() {
  try {
    await connectToRabbitMQ();

    //consume the event / subscribe to the events
    await consumeEvent('post.created', handlePostCreated)
    await consumeEvent('post.deleted', handlePostDeleted)

    app.listen(PORT, () => {
      logger.info(`Search sevice is running, ${PORT}`)
    })

  } catch (error) {
    logger.error('Failed to start search service', error);
    process.exit(1);
  }
}

startServer();
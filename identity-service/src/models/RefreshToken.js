const mongoose = require('mongoose')


const refreshToken = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  }
}, { timestamps: true })

refreshToken.index({ expireAt: 1 }, { expireAfterSeconds: 0 })

const RefreshToken = mongoose.model('RefreshToken', refreshToken)
module.exports = RefreshToken
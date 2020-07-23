const mongoose = require('mongoose');
const LastSyncSchema = new mongoose.Schema({
  requestUnixTime: {
    type: Number,
    unique: true,
  },
});
const LastSync = mongoose.model('LastSync', LastSyncSchema);
export default LastSync;
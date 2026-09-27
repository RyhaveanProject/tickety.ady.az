const mongoose = require('mongoose');

const syncLogSchema = new mongoose.Schema({
  source: { type: String, default: 'ticket.ady.az' },
  startedAt: { type: Date, default: Date.now, index: true },
  finishedAt: { type: Date },
  status: { type: String, enum: ['running', 'success', 'partial', 'blocked', 'failed'], default: 'running', index: true },
  httpStatus: { type: Number, default: 0 },
  stationsUpserted: { type: Number, default: 0 },
  trainsUpserted: { type: Number, default: 0 },
  tripsUpserted: { type: Number, default: 0 },
  faresUpserted: { type: Number, default: 0 },
  scannedLines: { type: [String], default: [] },
  message: { type: String, default: '' },
  triggeredBy: { type: String, default: 'system' },
  details: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

module.exports = mongoose.model('SyncLog', syncLogSchema);

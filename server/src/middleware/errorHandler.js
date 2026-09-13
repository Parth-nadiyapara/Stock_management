import { ApiError } from '../utils/ApiError.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Route not found' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ error: err.message, details: err.details });
  }

  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong on the server' });
}

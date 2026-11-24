import { AppError } from '../domain/errors.js';

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'NotFound',
    code: 'ROUTE_NOT_FOUND',
    details: null,
    requestId: req.rid,
  });
}

export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: err.error,
      code: err.code,
      details: err.details,
      requestId: req.rid,
    });
  }

  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      error: 'ValidationError',
      code: 'INVALID_JSON',
      details: null,
      requestId: req.rid,
    });
  }

  console.error('[unhandled]', req.rid, err);
  return res.status(500).json({
    error: 'internal_error',
    code: 'INTERNAL',
    details: null,
    requestId: req.rid,
  });
}

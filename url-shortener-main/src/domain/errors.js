export class AppError extends Error {
  constructor(status, error, message, { code = null, details = null } = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.error = error;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message, { code = 'VALIDATION_ERROR', details = null } = {}) {
    super(400, 'ValidationError', message, { code, details });
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', { code = 'NOT_FOUND' } = {}) {
    super(404, 'NotFound', message, { code });
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', { code = 'CONFLICT' } = {}) {
    super(409, 'Conflict', message, { code });
    this.name = 'ConflictError';
  }
}

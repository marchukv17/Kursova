export function createRateLimit({ windowMs = 10_000, max = 30 } = {}) {
  const buckets = new Map();

  return function rateLimit(req, res, next) {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : null) || req.socket.remoteAddress || 'local';
    const now = Date.now();

    let bucket = buckets.get(ip);
    if (!bucket || now - bucket.ts >= windowMs) {
      bucket = { count: 0, ts: now };
      buckets.set(ip, bucket);
    }
    bucket.count += 1;

    if (bucket.count > max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.ts + windowMs - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: 'too_many_requests',
        code: 'RATE_LIMITED',
        details: null,
        requestId: req.rid,
      });
    }

    next();
  };
}

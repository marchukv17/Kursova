const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createChaos({ enabled = process.env.CHAOS === '1' } = {}) {
  return function chaos(req, res, next) {
    const active = enabled || req.get('X-Chaos') === '1';
    if (!active) return next();

    const roll = Math.random();

    if (roll < 0.15) {
      const delay = 1200 + Math.floor(Math.random() * 1000);
      return sleep(delay).then(next);
    }

    if (roll < 0.35) {
      return res.status(503).json({
        error: 'service_unavailable',
        code: 'UPSTREAM_UNAVAILABLE',
        details: null,
        requestId: req.rid,
      });
    }

    if (roll < 0.45) {
      res.setHeader('Retry-After', '1');
      return res.status(429).json({
        error: 'too_many_requests',
        code: 'RATE_LIMITED',
        details: null,
        requestId: req.rid,
      });
    }

    return next();
  };
}

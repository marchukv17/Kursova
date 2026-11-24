import { NotFoundError } from '../domain/errors.js';

const RESERVED = new Set(['health', 'items', 'links', 'docs', 'api', 'favicon.ico']);

export function createRedirectHandler({ linkService }) {
  return function redirect(req, res, next) {
    const { slug } = req.params;
    if (RESERVED.has(slug)) return next();

    try {
      const target = linkService.resolveSlug(slug);
      return res.redirect(302, target);
    } catch (err) {
      if (err instanceof NotFoundError) return next();
      return next(err);
    }
  };
}

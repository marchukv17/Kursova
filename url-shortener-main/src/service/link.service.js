import { randomUUID, randomBytes } from 'node:crypto';
import { Link } from '../domain/Link.js';
import { NotFoundError, ConflictError } from '../domain/errors.js';

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function generateSlug(length = 7) {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function createLinkService(db, { baseUrl = process.env.BASE_URL || 'http://localhost:3000' } = {}) {
  const q = {
    list: db.prepare('SELECT * FROM links ORDER BY created_at DESC, id DESC'),
    byId: db.prepare('SELECT * FROM links WHERE id = ?'),
    bySlug: db.prepare('SELECT * FROM links WHERE slug = ?'),
    insert: db.prepare(
      'INSERT INTO links (id, slug, original_url, title, clicks, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ),
    update: db.prepare('UPDATE links SET original_url = ?, title = ?, updated_at = ? WHERE id = ?'),
    remove: db.prepare('DELETE FROM links WHERE id = ?'),
    incClicks: db.prepare('UPDATE links SET clicks = clicks + 1 WHERE slug = ?'),
  };

  function toResponse(link) {
    return { ...link.toJSON(), shortUrl: `${baseUrl.replace(/\/$/, '')}/${link.slug}` };
  }

  function slugTaken(slug) {
    return q.bySlug.get(slug) !== undefined;
  }

  function notFound(id) {
    return new NotFoundError(`Link "${id}" was not found`, { code: 'LINK_NOT_FOUND' });
  }

  return {
    list() {
      return q.list.all().map((row) => toResponse(Link.fromRow(row)));
    },

    getById(id) {
      const row = q.byId.get(id);
      if (!row) throw notFound(id);
      return toResponse(Link.fromRow(row));
    },

    resolveSlug(slug) {
      const row = q.bySlug.get(slug);
      if (!row) throw new NotFoundError(`Slug "${slug}" was not found`, { code: 'SLUG_NOT_FOUND' });
      q.incClicks.run(slug);
      return row.original_url;
    },

    create(input) {
      const data = Link.create(input);
      let slug = data.slug;

      if (!slug) {
        do {
          slug = generateSlug();
        } while (slugTaken(slug));
      } else if (slugTaken(slug)) {
        throw new ConflictError(`Slug "${slug}" is already taken`, { code: 'SLUG_TAKEN' });
      }

      const now = new Date().toISOString();
      const id = randomUUID();
      try {
        q.insert.run(id, slug, data.originalUrl, data.title, 0, now, now);
      } catch (err) {
        if (String(err.message).includes('UNIQUE')) {
          throw new ConflictError(`Slug "${slug}" is already taken`, { code: 'SLUG_TAKEN' });
        }
        throw err;
      }

      return toResponse(Link.fromRow(q.byId.get(id)));
    },

    update(id, patch) {
      const row = q.byId.get(id);
      if (!row) throw notFound(id);

      const merged = Link.update(Link.fromRow(row), patch);
      const now = new Date().toISOString();
      q.update.run(merged.originalUrl, merged.title, now, id);
      return toResponse(Link.fromRow(q.byId.get(id)));
    },

    remove(id) {
      const row = q.byId.get(id);
      if (!row) throw notFound(id);
      q.remove.run(id);
      return true;
    },
  };
}

import { ValidationError } from './errors.js';

const SLUG_RE = /^[A-Za-z0-9_-]{3,32}$/;

function invalid(field, code, message) {
  return new ValidationError(message, {
    code,
    details: [{ field, message }],
  });
}

export class Link {
  constructor({ id, slug, originalUrl, title = null, clicks = 0, createdAt, updatedAt }) {
    this.id = id;
    this.slug = slug;
    this.originalUrl = originalUrl;
    this.title = title;
    this.clicks = clicks;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static validateUrl(value) {
    if (typeof value !== 'string' || value.trim() === '') {
      throw invalid('originalUrl', 'ORIGINAL_URL_REQUIRED', 'originalUrl is required');
    }
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      parsed = null;
    }
    if (!parsed || !['http:', 'https:'].includes(parsed.protocol)) {
      throw invalid('originalUrl', 'ORIGINAL_URL_INVALID', 'originalUrl must be a valid http(s) URL');
    }
    return value.trim();
  }

  static validateSlug(value) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string' || !SLUG_RE.test(value)) {
      throw invalid('slug', 'SLUG_INVALID', 'slug must be 3-32 characters of [A-Za-z0-9_-]');
    }
    return value;
  }

  static validateTitle(value) {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string') {
      throw invalid('title', 'TITLE_INVALID', 'title must be a string');
    }
    return value;
  }

  static create(input = {}) {
    return {
      originalUrl: Link.validateUrl(input.originalUrl),
      slug: Link.validateSlug(input.slug),
      title: Link.validateTitle(input.title),
    };
  }

  static update(existing, patch = {}) {
    const originalUrl = 'originalUrl' in patch ? Link.validateUrl(patch.originalUrl) : existing.originalUrl;
    const title = 'title' in patch ? Link.validateTitle(patch.title) : existing.title;
    return { originalUrl, title };
  }

  static fromRow(row) {
    return new Link({
      id: row.id,
      slug: row.slug,
      originalUrl: row.original_url,
      title: row.title,
      clicks: row.clicks,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  toJSON() {
    return {
      id: this.id,
      slug: this.slug,
      originalUrl: this.originalUrl,
      title: this.title,
      clicks: this.clicks,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

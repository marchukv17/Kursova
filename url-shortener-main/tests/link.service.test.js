import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createDatabase } from '../src/infra/db.js';
import { createLinkService } from '../src/service/link.service.js';
import { ValidationError, NotFoundError, ConflictError } from '../src/domain/errors.js';

function freshService() {
  const db = createDatabase(':memory:');
  return { db, service: createLinkService(db, { baseUrl: 'http://test.local' }) };
}

test('service: create() returns a normalized link (success case)', () => {
  const { service } = freshService();

  const link = service.create({ originalUrl: 'https://example.com/page', title: 'Example' });

  assert.ok(link.id);
  assert.match(link.slug, /^[A-Za-z0-9_-]{3,32}$/);
  assert.equal(link.originalUrl, 'https://example.com/page');
  assert.equal(link.title, 'Example');
  assert.equal(link.clicks, 0);
  assert.equal(link.shortUrl, `http://test.local/${link.slug}`);
  assert.ok(link.createdAt);
});

test('service: create() without originalUrl throws ValidationError (failure case)', () => {
  const { service } = freshService();

  assert.throws(
    () => service.create({ title: 'No url here' }),
    (err) => {
      assert.ok(err instanceof ValidationError);
      assert.equal(err.status, 400);
      assert.equal(err.code, 'ORIGINAL_URL_REQUIRED');
      assert.equal(err.details[0].field, 'originalUrl');
      return true;
    }
  );
});

test('service: create() rejects a non-http(s) URL', () => {
  const { service } = freshService();

  assert.throws(
    () => service.create({ originalUrl: 'ftp://example.com' }),
    (err) => err instanceof ValidationError && err.code === 'ORIGINAL_URL_INVALID'
  );
});

test('service: create() with a taken slug throws ConflictError', () => {
  const { service } = freshService();
  service.create({ originalUrl: 'https://a.example', slug: 'promo' });

  assert.throws(
    () => service.create({ originalUrl: 'https://b.example', slug: 'promo' }),
    (err) => err instanceof ConflictError && err.code === 'SLUG_TAKEN'
  );
});

test('service: getById() throws NotFoundError for unknown id', () => {
  const { service } = freshService();

  assert.throws(
    () => service.getById('does-not-exist'),
    (err) => err instanceof NotFoundError && err.code === 'LINK_NOT_FOUND'
  );
});

test('service: update() changes title but keeps immutable slug', () => {
  const { service } = freshService();
  const created = service.create({ originalUrl: 'https://example.com', title: 'Old' });

  const updated = service.update(created.id, { title: 'New' });

  assert.equal(updated.id, created.id);
  assert.equal(updated.slug, created.slug);
  assert.equal(updated.title, 'New');
});

test('service: resolveSlug() returns the target URL and increments clicks', () => {
  const { service } = freshService();
  const created = service.create({ originalUrl: 'https://example.com/deep', slug: 'deep-link' });

  const target = service.resolveSlug('deep-link');
  assert.equal(target, 'https://example.com/deep');

  const after = service.getById(created.id);
  assert.equal(after.clicks, 1);
});

test('service: remove() deletes a link and then reports NotFound', () => {
  const { service } = freshService();
  const created = service.create({ originalUrl: 'https://example.com' });

  service.remove(created.id);
  assert.throws(() => service.getById(created.id), NotFoundError);
});

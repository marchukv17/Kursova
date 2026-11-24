import { Item } from '../domain/Item.js';

export function createItemService(db) {
  const selectAll = db.prepare('SELECT id, name FROM items ORDER BY id');

  return {
    list() {
      return selectAll.all().map((row) => Item.fromRow(row).toJSON());
    },
  };
}

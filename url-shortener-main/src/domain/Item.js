export class Item {
  constructor({ id, name }) {
    this.id = id;
    this.name = name;
  }

  static fromRow(row) {
    return new Item({ id: row.id, name: row.name });
  }

  toJSON() {
    return { id: this.id, name: this.name };
  }
}

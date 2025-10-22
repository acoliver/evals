DROP TABLE IF EXISTS inventory;
CREATE TABLE inventory (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

INSERT INTO inventory (id, name, sku, price_cents, created_at) VALUES
  (1, 'Notebook', 'NB-001', 799, '2024-01-01T09:00:00.000Z'),
  (2, 'Mechanical Keyboard', 'KB-235', 12999, '2024-01-02T12:30:00.000Z'),
  (3, 'Wireless Mouse', 'MS-984', 4999, '2024-01-03T08:15:00.000Z'),
  (4, 'Laptop Stand', 'LP-742', 3599, '2024-01-04T10:05:00.000Z'),
  (5, 'Monitor 24"', 'MN-240', 18999, '2024-01-04T15:45:00.000Z'),
  (6, 'USB-C Hub', 'HB-611', 2599, '2024-01-05T11:20:00.000Z'),
  (7, 'Portable SSD', 'SD-552', 14999, '2024-01-06T14:55:00.000Z'),
  (8, 'Desk Lamp', 'DL-883', 3999, '2024-01-07T18:35:00.000Z'),
  (9, 'Noise Cancelling Headphones', 'HP-664', 21999, '2024-01-08T09:05:00.000Z'),
  (10, 'Ergonomic Chair', 'CH-120', 32999, '2024-01-09T16:40:00.000Z'),
  (11, '4K Monitor', 'MN-401', 24999, '2024-01-10T08:50:00.000Z'),
  (12, 'Smart Speaker', 'SP-304', 8999, '2024-01-11T13:10:00.000Z'),
  (13, 'Webcam HD', 'WC-777', 6999, '2024-01-12T11:45:00.000Z'),
  (14, 'Graphics Tablet', 'GT-550', 17999, '2024-01-13T17:25:00.000Z'),
  (15, 'Portable Charger', 'PC-205', 3499, '2024-01-14T10:30:00.000Z');

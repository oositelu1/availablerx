-- Create Purchase Orders table
CREATE TABLE IF NOT EXISTS "purchase_orders" (
  "id" SERIAL PRIMARY KEY,
  "po_number" VARCHAR(50) NOT NULL UNIQUE,
  "supplier_gln" VARCHAR(50) NOT NULL,
  "order_date" DATE NOT NULL,
  "expected_delivery_date" DATE,
  "status" VARCHAR(20) NOT NULL DEFAULT 'open',
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "created_by" INTEGER NOT NULL REFERENCES "users"("id"),
  "metadata" JSONB
);

-- Create EPCIS-to-PO associations table
CREATE TABLE IF NOT EXISTS "epcis_po_associations" (
  "id" SERIAL PRIMARY KEY,
  "file_id" INTEGER NOT NULL REFERENCES "files"("id"),
  "po_id" INTEGER NOT NULL REFERENCES "purchase_orders"("id"),
  "association_method" VARCHAR(30) NOT NULL,
  "confidence" INTEGER,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "created_by" INTEGER NOT NULL REFERENCES "users"("id"),
  "notes" TEXT
);

-- Create Product Items table
CREATE TABLE IF NOT EXISTS "product_items" (
  "id" SERIAL PRIMARY KEY,
  "file_id" INTEGER NOT NULL REFERENCES "files"("id"),
  "gtin" VARCHAR(50) NOT NULL,
  "serial_number" VARCHAR(100) NOT NULL,
  "lot_number" VARCHAR(50) NOT NULL,
  "expiration_date" DATE NOT NULL,
  "event_time" TIMESTAMP NOT NULL,
  "source_gln" VARCHAR(50),
  "destination_gln" VARCHAR(50),
  "biz_transaction_list" JSONB,
  "po_id" INTEGER REFERENCES "purchase_orders"("id"),
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create Scanned Items table
CREATE TABLE IF NOT EXISTS "scanned_items" (
  "id" SERIAL PRIMARY KEY,
  "gtin" VARCHAR(50) NOT NULL,
  "serial_number" VARCHAR(100) NOT NULL,
  "lot_number" VARCHAR(50) NOT NULL,
  "expiration_date" DATE NOT NULL,
  "raw_data" TEXT NOT NULL,
  "scanned_by" INTEGER NOT NULL REFERENCES "users"("id"),
  "scanned_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "scanned_via" VARCHAR(30) NOT NULL,
  "product_item_id" INTEGER REFERENCES "product_items"("id"),
  "match_result" VARCHAR(20) NOT NULL,
  "mismatch_reason" TEXT,
  "po_id" INTEGER REFERENCES "purchase_orders"("id")
);

-- Create Validation Sessions table
CREATE TABLE IF NOT EXISTS "validation_sessions" (
  "id" SERIAL PRIMARY KEY,
  "po_id" INTEGER REFERENCES "purchase_orders"("id"),
  "file_id" INTEGER REFERENCES "files"("id"),
  "started_by" INTEGER NOT NULL REFERENCES "users"("id"),
  "started_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "completed_at" TIMESTAMP,
  "status" VARCHAR(20) NOT NULL DEFAULT 'in_progress',
  "total_scanned" INTEGER DEFAULT 0,
  "total_matched" INTEGER DEFAULT 0,
  "total_mismatched" INTEGER DEFAULT 0,
  "notes" TEXT
);

-- Create Audit Logs table
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" SERIAL PRIMARY KEY,
  "action" VARCHAR(100) NOT NULL,
  "entity_type" VARCHAR(50) NOT NULL,
  "entity_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
  "timestamp" TIMESTAMP NOT NULL DEFAULT NOW(),
  "details" JSONB,
  "ip_address" VARCHAR(50)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_items_file_id ON product_items(file_id);
CREATE INDEX IF NOT EXISTS idx_product_items_gtin ON product_items(gtin);
CREATE INDEX IF NOT EXISTS idx_product_items_lot_number ON product_items(lot_number);
CREATE INDEX IF NOT EXISTS idx_product_items_serial_number ON product_items(serial_number);
CREATE INDEX IF NOT EXISTS idx_product_items_po_id ON product_items(po_id);

CREATE INDEX IF NOT EXISTS idx_scanned_items_gtin ON scanned_items(gtin);
CREATE INDEX IF NOT EXISTS idx_scanned_items_product_item_id ON scanned_items(product_item_id);
CREATE INDEX IF NOT EXISTS idx_scanned_items_po_id ON scanned_items(po_id);

CREATE INDEX IF NOT EXISTS idx_validation_sessions_po_id ON validation_sessions(po_id);
CREATE INDEX IF NOT EXISTS idx_validation_sessions_file_id ON validation_sessions(file_id);

CREATE INDEX IF NOT EXISTS idx_epcis_po_associations_file_id ON epcis_po_associations(file_id);
CREATE INDEX IF NOT EXISTS idx_epcis_po_associations_po_id ON epcis_po_associations(po_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type_id ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
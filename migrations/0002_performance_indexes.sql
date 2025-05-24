-- Performance optimization indexes for DocumentTracker
-- These indexes target the most common query patterns identified in the codebase

-- Product Items indexes (frequently queried by GTIN, serial, and relationships)
CREATE INDEX IF NOT EXISTS idx_product_items_file_id ON product_items(file_id);
CREATE INDEX IF NOT EXISTS idx_product_items_po_id ON product_items(po_id);
CREATE INDEX IF NOT EXISTS idx_product_items_gtin_serial ON product_items(gtin, serial_number);
CREATE INDEX IF NOT EXISTS idx_product_items_gtin ON product_items(gtin);
CREATE INDEX IF NOT EXISTS idx_product_items_lot_number ON product_items(lot_number);

-- Inventory and transactions (frequently filtered by date and product)
CREATE INDEX IF NOT EXISTS idx_inventory_gtin_serial ON inventory(gtin, serial_number);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_date ON inventory_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_product ON inventory_transactions(gtin, serial_number);

-- Files (frequently filtered by status and date)
CREATE INDEX IF NOT EXISTS idx_files_status_created ON files(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON files(uploaded_by);

-- Purchase Orders and Sales Orders (frequently queried by status and date)
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created ON purchase_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_created ON sales_orders(created_at DESC);

-- EPCIS PO Associations (join optimization)
CREATE INDEX IF NOT EXISTS idx_epcis_po_associations_file_po ON epcis_po_associations(file_id, po_id);

-- Transmissions (frequently queried by status and file)
CREATE INDEX IF NOT EXISTS idx_transmissions_file_id ON transmissions(file_id);
CREATE INDEX IF NOT EXISTS idx_transmissions_status ON transmissions(status);

-- Pre-signed links (UUID lookups)
CREATE INDEX IF NOT EXISTS idx_presigned_links_uuid ON presigned_links(uuid);
CREATE INDEX IF NOT EXISTS idx_presigned_links_expires ON presigned_links(expires_at);

-- Audit logs (time-based queries)
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- Invoice lookups
CREATE INDEX IF NOT EXISTS idx_invoices_po_number ON invoices(po_number);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
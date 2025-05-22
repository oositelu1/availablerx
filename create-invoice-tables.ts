import { db, pool } from './server/db';
import { sql } from 'drizzle-orm';

async function createInvoiceTables() {
  try {
    console.log('Creating invoice tables...');
    
    // Create invoices table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        filepath VARCHAR(255) NOT NULL,
        uploaded_by INTEGER NOT NULL REFERENCES users(id),
        uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        invoice_number VARCHAR(100) NOT NULL,
        invoice_date DATE NOT NULL,
        po_number VARCHAR(100),
        vendor_name VARCHAR(200),
        vendor_address TEXT,
        customer_name VARCHAR(200),
        customer_address TEXT,
        purchase_order_id INTEGER REFERENCES purchase_orders(id),
        extracted_data JSONB,
        match_score DECIMAL(5,4),
        reconciled_by INTEGER REFERENCES users(id),
        reconciled_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP
      )
    `);
    
    console.log('Invoices table created.');
    
    // Create invoice_items table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS invoice_items (
        id SERIAL PRIMARY KEY,
        invoice_id INTEGER NOT NULL REFERENCES invoices(id),
        line_number INTEGER NOT NULL,
        description TEXT NOT NULL,
        lot_number VARCHAR(50),
        ndc VARCHAR(20),
        gtin VARCHAR(50),
        expiry_date DATE,
        quantity INTEGER NOT NULL,
        unit_price DECIMAL(10,2),
        total_price DECIMAL(10,2),
        status VARCHAR(20) DEFAULT 'pending',
        match_score DECIMAL(5,4),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP
      )
    `);
    
    console.log('Invoice items table created.');
    console.log('All invoice tables created successfully.');
    
  } catch (error) {
    console.error('Error creating invoice tables:', error);
  } finally {
    await pool.end();
  }
}

createInvoiceTables();
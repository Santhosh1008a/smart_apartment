require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { query } = require('../src/config/db');

async function run() {
  const statements = [
    // === UNIQUE CONSTRAINTS ===
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_razorpay_txns_payment_id_unique
     ON razorpay_txns(rz_payment_id) WHERE rz_payment_id IS NOT NULL`,

    // === PERFORMANCE INDEXES ===
    `CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`,
    `CREATE INDEX IF NOT EXISTS idx_users_complex_id ON users(complex_id)`,
    `CREATE INDEX IF NOT EXISTS idx_units_status ON units(status)`,
    `CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)`,
    `CREATE INDEX IF NOT EXISTS idx_invoices_unit_id ON invoices(unit_id)`,
    `CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)`,
    `CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id)`,
    `CREATE INDEX IF NOT EXISTS idx_razorpay_txns_order_id ON razorpay_txns(rz_order_id)`,
    `CREATE INDEX IF NOT EXISTS idx_visitor_passes_status ON visitor_passes(status)`,
    `CREATE INDEX IF NOT EXISTS idx_visitor_passes_valid_from ON visitor_passes(valid_from)`,
    `CREATE INDEX IF NOT EXISTS idx_vendor_requests_status ON vendor_requests(status)`,
  ];

  for (const sql of statements) {
    try {
      await query(sql);
      // Extract index name for logging
      const match = sql.match(/idx_\w+/);
      console.log(`  ✓ ${match ? match[0] : 'OK'}`);
    } catch (e) {
      // Skip if already exists
      if (e.message.includes('already exists')) {
        const match = sql.match(/idx_\w+/);
        console.log(`  - ${match ? match[0] : ''} (already exists)`);
      } else {
        console.error(`  ✗ FAILED:`, e.message);
      }
    }
  }

  console.log('\nMigration complete');
  process.exit(0);
}

run();

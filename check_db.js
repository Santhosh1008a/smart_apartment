require('dotenv').config();
const { pool } = require('./src/config/db');
pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'visitor_passes'")
  .then(res => console.log(res.rows.map(r => r.column_name)))
  .catch(err => console.log(err.message))
  .finally(() => process.exit());

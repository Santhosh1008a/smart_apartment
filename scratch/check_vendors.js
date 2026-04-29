require('dotenv').config({path: '../.env'});
const { query } = require('../src/config/db');

query("SELECT id, full_name, email, role, vendor_category, complex_id FROM users WHERE role = 'vendor'")
  .then(res => { 
    console.table(res.rows); 
    process.exit(0); 
  })
  .catch(console.error);

// Quick database query tool for ad-hoc SQL queries
import { pool } from './server/db.js';

async function runQuery(sqlQuery) {
  try {
    console.log('Executing query:', sqlQuery);
    const result = await pool.query(sqlQuery);
    console.log('Results:');
    console.table(result.rows);
    console.log(`\nReturned ${result.rows.length} rows`);
  } catch (error) {
    console.error('Query error:', error.message);
  } finally {
    await pool.end();
  }
}

// Get command line argument for SQL query
const query = process.argv[2];
if (!query) {
  console.log('Usage: node db-query.js "SELECT * FROM table_name"');
  process.exit(1);
}

runQuery(query);
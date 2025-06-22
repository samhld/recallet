// Interactive database console for ad-hoc queries
import { pool } from './server/db.js';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🗄️  Database Console Ready');
console.log('Type SQL queries or commands:');
console.log('- "tables" to list all tables');
console.log('- "desc <table>" to describe table structure');
console.log('- "exit" to quit\n');

async function executeQuery(query) {
  try {
    const result = await pool.query(query);
    if (result.rows.length > 0) {
      console.table(result.rows);
      console.log(`\n✅ ${result.rows.length} rows returned\n`);
    } else {
      console.log('✅ Query executed successfully (no rows returned)\n');
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}\n`);
  }
}

function handleCommand(input) {
  const cmd = input.trim().toLowerCase();
  
  if (cmd === 'exit') {
    console.log('Goodbye!');
    pool.end();
    rl.close();
    return;
  }
  
  if (cmd === 'tables') {
    executeQuery(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    return;
  }
  
  if (cmd.startsWith('desc ')) {
    const tableName = cmd.substring(5).trim();
    executeQuery(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = '${tableName}' 
      ORDER BY ordinal_position;
    `);
    return;
  }
  
  // Execute as SQL query
  executeQuery(input);
}

function prompt() {
  rl.question('sql> ', (input) => {
    handleCommand(input);
    if (!rl.closed) prompt();
  });
}

prompt();
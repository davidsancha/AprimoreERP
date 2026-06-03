const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

let supabaseUrl = '';
let supabaseKey = '';

envContent.split('\n').forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim();
});

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Using an existing RPC if available, otherwise this might fail if execute_sql is not defined.
  // Assuming the user has created the 'execute_sql' rpc in previous sessions.
  const { data, error } = await supabase.rpc('execute_sql', {
    query: `
      ALTER TABLE operacional_projetos
      ADD COLUMN IF NOT EXISTS cliente_final_id uuid REFERENCES crm_clientes(id) ON DELETE SET NULL;
    `
  });

  if (error) {
    console.error('Error executing SQL via RPC:', error.message);
  } else {
    console.log('Column cliente_final_id added to operacional_projetos successfully.', data);
  }
}

main();

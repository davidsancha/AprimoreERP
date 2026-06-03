import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase.rpc('execute_sql', {
    query: `
      ALTER TABLE operacional_projetos
      ADD COLUMN IF NOT EXISTS cliente_final_id uuid REFERENCES crm_clientes(id) ON DELETE SET NULL;
    `
  });

  if (error) {
    // If we don't have execute_sql, we'll need to create the column using DDL API if possible, or we will just warn.
    // Assuming execute_sql was created in previous steps. If not, we will need to use REST/GraphQL or create it.
    console.error('Error executing SQL via RPC:', error.message);
  } else {
    console.log('Column cliente_final_id added to operacional_projetos successfully.', data);
  }
}

main();

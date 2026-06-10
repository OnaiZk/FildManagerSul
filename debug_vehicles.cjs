const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ytqgrfuageleoebfabdl.supabase.co';
const supabaseKey = 'sb_publishable_PYdUNkZVJYhLlLQy9bl9tg_POzzH1qC';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Checking columns of vehicles table...");
    // Try to select 'tag'
    const { data: d1, error: e1 } = await supabase.from('vehicles').select('tag').limit(1);
    if (e1) {
        console.error("Error selecting tag from vehicles:", e1);
    } else {
        console.log("Column 'tag' exists.");
    }
}

check();

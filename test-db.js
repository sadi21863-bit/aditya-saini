require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL);
sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1`
    .then(r => { r.forEach(x => console.log(x.table_name)); process.exit(); })
    .catch(e => { console.error(e.message); process.exit(1); });
const endpoints = [
  '/',
  '/withdraw-request',
  '/bill-follow',
  '/bills',
  '/contract-open',
  '/petty-cash',
  '/project-analytics',
  '/views/stores',
  '/views/contractors',
  '/views/people',
  '/views/cars',
  '/views/banks',
  '/views/customers',
  '/views/companies',
  '/api/line/config',
  '/api/line/quota',
  '/api/system-options?id=company_settings',
  '/api/form-schema?tableName=Data',
  '/api/rows?tableName=stores&limit=50',
  '/api/rows?tableName=contractors&limit=50',
  '/api/rows?tableName=bills&limit=50'
];

async function checkAll() {
  console.log('Testing endpoints on http://localhost:3001...');
  for (const ep of endpoints) {
    const t0 = Date.now();
    try {
      const res = await fetch('http://localhost:3001' + ep);
      const elapsed = Date.now() - t0;
      const statusIcon = res.status === 200 ? '✅' : '❌';
      console.log(`${statusIcon} [${res.status}] ${ep} (${elapsed}ms)`);
    } catch (e: any) {
      console.log(`❌ [ERR] ${ep}: ${e.message}`);
    }
  }
}

checkAll();

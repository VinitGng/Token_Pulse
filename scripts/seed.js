// scripts/seed.js
// Seeds the database with realistic multi-team enterprise usage data

import { initDb, seedSampleData, getAnalytics } from '../src/db.js';

initDb();
const count = Number(process.argv[2]) || 120;
console.log(`Seeding database with ${count} realistic enterprise LLM requests across 5 teams...`);

const result = seedSampleData(count);
console.log(`Successfully generated and stored ${result.seeded} requests!`);

const analytics = getAnalytics();
console.log('\nCurrent System Totals:');
console.log(`- Total Requests: ${analytics.summary.total_requests}`);
console.log(`- Total Tokens:   ${analytics.summary.total_tokens.toLocaleString()}`);
console.log(`- Total Cost:     $${analytics.summary.total_cost.toFixed(4)} USD`);
console.log(`- Active Teams:   ${analytics.by_team.map(t => `${t.team} ($${t.total_cost})`).join(', ')}`);

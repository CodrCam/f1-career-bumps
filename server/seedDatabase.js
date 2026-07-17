import { createF1Database } from './f1Database.js';

const year = Number(process.argv[2] ?? 2025);
const database = await createF1Database();

await database.reseed(year);
console.log(JSON.stringify(database.getSeasonSummary(year), null, 2));
database.close();

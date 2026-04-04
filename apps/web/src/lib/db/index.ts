import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Connection pooler URL (transaction mode) -- MUST set prepare: false
// PgBouncer in transaction mode does not support prepared statements
const client = postgres(process.env.DATABASE_URL!, {
	prepare: false,
	max: 10,
	idle_timeout: 20,
	connect_timeout: 10,
});

export const db = drizzle({ client, schema });

import { db } from "../src/lib/db";
import { sql } from "drizzle-orm";

async function main() {
  try {
    const res = await db.execute(sql`
        SELECT DISTINCT ON (tp.trade_id)
            tp.trade_id,
            tp.proposer_id
        FROM trade_proposals tp
        WHERE tp.status = 'pending'
        ORDER BY tp.trade_id, tp.sequence_number DESC
        LIMIT 1
    `);
    console.log("Success:", res);
  } catch (err) {
    console.error("DB Error:", err);
  }
}
main();

import { asyncBufferFromFile, parquetReadObjects } from "hyparquet";
import fs from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DATABASE_FILE, PARQUET_DIR, SHOULD_INDEX_COLUMNS } from "./config.ts";

function initializeTable(tableName: string, object: object): void {
  const columns = Object.keys(object)
    .map((key) => {
      const value = object[key];
      let type = "TEXT";
      if (
        typeof value === "number" ||
        typeof value === "bigint" ||
        typeof value === "boolean"
      ) {
        type = "INTEGER";
      }
      return `${key} ${type}`;
    })
    .join(", ");
  const query = `CREATE TABLE IF NOT EXISTS ${tableName} (${columns})`;

  console.log(`Creating table ${tableName} with columns: ${columns}`);
  database.exec(query);

  // Create indexes for performance
  const keySet = new Set(Object.keys(object));
  for (const spec of SHOULD_INDEX_COLUMNS) {
    const [indexTableName, columnName] = spec.split(".");
    if (indexTableName !== tableName) {
      continue; // Skip if the column does not belong to the current table
    }
    if (!keySet.has(columnName)) {
      console.warn(`Column ${columnName} not found in table ${tableName}`);
      continue; // Skip if the column does not exist in the current object
    }
    // Create index only if the column exists in the current table
    console.log(`Creating index for ${indexTableName}.${columnName}`);
    database.exec(
      `CREATE INDEX IF NOT EXISTS idx_${tableName}_${columnName} ON ${tableName} (${columnName})`,
    );
  }

  console.log(`Table ${tableName} initialized with columns: ${columns}`);
}

async function importParquet(
  database: DatabaseSync,
  filename: string,
): Promise<void> {
  const file = await asyncBufferFromFile(filename);
  const objects = await parquetReadObjects({ file });
  if (objects.length === 0) {
    console.warn(`No objects found in ${filename}`);
    return;
  }

  console.log(`Importing ${objects.length} objects from ${filename}`);

  const tableName = path.basename(filename, ".parquet");
  initializeTable(tableName, objects[0]);

  const insertQuery = `INSERT INTO ${tableName} (${Object.keys(objects[0]).join(
    ", ",
  )}) VALUES (${Object.keys(objects[0])
    .map(() => "?")
    .join(", ")})`;

  const stmt = database.prepare(insertQuery);

  // Use a transaction for bulk insertion performance
  database.exec("BEGIN TRANSACTION");

  try {
    for (const obj of objects) {
      stmt.run(
        ...Object.values(obj).map((value) => {
          if (Array.isArray(value)) {
            return JSON.stringify(value);
          }
          if (typeof value === "boolean") {
            return value ? 1 : 0;
          }
          if (typeof value === "object" && value !== null) {
            return JSON.stringify(value);
          }
          return value as string | number | bigint | null;
        }),
      );
    }

    // Commit the transaction
    database.exec("COMMIT");
  } catch (error) {
    // Rollback on error
    database.exec("ROLLBACK");
    throw error;
  }

  console.log(`Imported ${objects.length} objects into table ${tableName}`);
}

try {
  await fs.unlink(path.join(PARQUET_DIR, "database.db"));
} catch (error) {
  if (error.code !== "ENOENT") {
    console.error("Failed to delete existing database:", error);
  }
}

const database = new DatabaseSync(DATABASE_FILE);

for (const filename of await fs.readdir(PARQUET_DIR)) {
  if (filename.endsWith(".parquet")) {
    await importParquet(database, path.join(PARQUET_DIR, filename));
  }
}

database.close();

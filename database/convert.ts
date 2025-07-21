import fs from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { CSV_DIR, DATABASE_FILE } from "./config.ts";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function formatCsvRow(
  tagName: string,
  category: number,
  postCount: number,
  aliasNames: readonly (string | null)[],
): string {
  const strAliases = aliasNames
    .filter((name) => name != null && name !== tagName)
    .map((name) => (name as string).replaceAll(",", ""))
    .join(",");
  return `${csvEscape(tagName)},${category},${postCount},${csvEscape(strAliases)}\n`;
}

async function createGeneralTagsCsv(
  database: DatabaseSync,
  minPostCount: number,
): Promise<void> {
  // For each record of the "tags" table that meet: `"tags.is_deprecated" == 0 AND "tags.post_count" >= MIN_POST_COUNT AND "tags.category" != 1`,
  // Collect "tag_aliases.antecedent_name" where "tag_aliases.consequent_name" matches the "tags.name" and "tag_aliases.status" is 'active'.
  //
  // For each "tag_aliases.antecedent_name" and "tags.name" itself, collect the "wiki_pages.other_names" (JSON array) where "wiki_pages.title" matches the "tag_aliases.antecedent_name" or "tags.name".
  // Finally, group by "tags.name", collect all "tag_aliases.antecedent_name" and "wiki_pages.other_names" respectively in JSON arrays, and return a table that has ["tags.name", "tag_aliases.antecedent_name", "wiki_pages.other_names"] as columns.

  const query = `
    SELECT
      tags.name AS name,
      tags.category AS category,
      tags.post_count AS post_count,
      JSON_GROUP_ARRAY(DISTINCT tag_aliases.antecedent_name) AS alias_names,
      JSON_GROUP_ARRAY(DISTINCT JSON(wiki_pages.other_names)) AS other_names
    FROM tags
    LEFT JOIN tag_aliases ON tag_aliases.consequent_name = tags.name AND tag_aliases.status = 'active'
    LEFT JOIN wiki_pages ON wiki_pages.title IN (tag_aliases.antecedent_name, tags.name)
    WHERE tags.is_deprecated = 0
      AND tags.post_count >= ?
      AND tags.category != 1
      AND tags.category != 5
    GROUP BY tags.name
    ORDER BY tags.post_count DESC
  `;

  console.log("Querying for general tags with post count >= ", minPostCount);

  const stmt = database.prepare(query);
  const rows = stmt.all(minPostCount);

  console.log(`Found ${rows.length} general tags to export`);

  let csv = "";
  for (const row of rows) {
    const tagName = row.name as string;
    const category = row.category as number;
    const postCount = row.post_count as number;

    const aliasNames = Array.from(
      new Set(JSON.parse(row.alias_names as string)),
    ) as string[];
    const otherNames = Array.from(
      new Set((JSON.parse(row.other_names as string) as string[]).flat()),
    ) as string[];

    csv += formatCsvRow(tagName, category, postCount, [
      ...aliasNames,
      ...otherNames,
    ]);
  }

  await fs.writeFile(
    path.join(CSV_DIR, `danbooru_tags_general_min${minPostCount}.csv`),
    csv,
  );

  console.log(`Exported ${rows.length} general tags to CSV`);
}

async function createArtistTagsCsv(
  database: DatabaseSync,
  minPostCount: number,
): Promise<void> {
  const query = `
    SELECT
      tags.name AS name,
      tags.category AS category,
      tags.post_count AS post_count,
      JSON_GROUP_ARRAY(DISTINCT tag_aliases.antecedent_name) AS alias_names,
      JSON_GROUP_ARRAY(DISTINCT JSON(artists.other_names)) AS other_names,
      artists.group_name AS group_name
    FROM tags
    LEFT JOIN tag_aliases ON tag_aliases.consequent_name = tags.name AND tag_aliases.status = 'active'
    INNER JOIN artists ON artists.name = tags.name
    WHERE tags.is_deprecated = 0
      AND tags.post_count >= ?
      AND tags.category == 1
      AND artists.is_deleted = 0
      AND artists.is_banned = 0
      AND tags.name != 'banned_artist'
    GROUP BY tags.name
    ORDER BY tags.post_count DESC
  `;

  console.log("Querying for artist tags with post count >= ", minPostCount);

  const stmt = database.prepare(query);
  const rows = stmt.all(minPostCount);

  console.log(`Found ${rows.length} artist tags to export`);

  let csvFull = "";
  let csvSimple = "";
  for (const row of rows) {
    const tagName = `artist:${row.name}`;
    const category = row.category as number;
    const postCount = row.post_count as number;

    const aliasNames = Array.from(
      new Set(JSON.parse(row.alias_names as string)),
    ) as string[];
    const otherNames = Array.from(
      new Set((JSON.parse(row.other_names as string) as string[]).flat()),
    ) as string[];

    const groupName = row.group_name as string | null;
    const groupNameArr = groupName
      ? [`group:${groupName.replaceAll(",", "")}`]
      : [];

    csvFull += formatCsvRow(tagName, category, postCount, [
      ...groupNameArr,
      ...aliasNames,
      ...otherNames,
    ]);
    csvSimple += formatCsvRow(tagName, category, postCount, [
      ...groupNameArr,
      ...aliasNames,
    ]);
  }

  await fs.writeFile(
    path.join(CSV_DIR, `danbooru_tags_artist_min${minPostCount}_full.csv`),
    csvFull,
  );
  await fs.writeFile(
    path.join(CSV_DIR, `danbooru_tags_artist_min${minPostCount}_simple.csv`),
    csvSimple,
  );

  console.log(`Exported ${rows.length} artist tags to CSV`);
}

const database = new DatabaseSync(DATABASE_FILE);

for (const minPostCount of [1, 10, 20, 50, 100, 500, 1000]) {
  await createGeneralTagsCsv(database, minPostCount);
  await createArtistTagsCsv(database, minPostCount);
}

database.close();

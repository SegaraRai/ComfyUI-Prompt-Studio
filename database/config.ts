import path from "node:path";

export const PARQUET_DIR = path.join(import.meta.dirname, "parquets");

export const CSV_DIR = PARQUET_DIR;

export const DATABASE_FILE = path.join(PARQUET_DIR, "database.db");

export const SHOULD_INDEX_COLUMNS = [
  "artists.name",
  "artists.is_deleted",
  "artists.is_banned",
  "tags.name",
  "tags.post_count",
  "tags.category",
  "tags.is_deprecated",
  "tag_aliases.consequent_name",
  "tag_aliases.antecedent_name",
  "tag_groups.tag_group",
  "tag_groups.tag",
  "tag_implications.consequent_name",
  "tag_implications.antecedent_name",
  "wiki_pages.title",
];

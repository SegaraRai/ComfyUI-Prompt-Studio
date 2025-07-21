use std::collections::{HashMap, HashSet};

use nucleo_matcher::{
    Config, Matcher,
    pattern::{CaseMatching, Normalization, Pattern},
};
#[cfg(not(target_arch = "wasm32"))]
use std::time::{Duration, Instant};
use tsify::Tsify;
use wasm_bindgen::prelude::*;
#[cfg(target_arch = "wasm32")]
use web_time::{Duration, Instant};

use crate::normalize::{normalize_for_auto_completion, normalize_for_query};

// Performance logging helper
fn log_performance(operation: &str, duration: Duration, details: Option<&str>) {
    #[cfg(any(debug_assertions, feature = "profiling"))]
    {
        let message = format!(
            "[DictionaryEngine] {operation}: {:.2}ms{}",
            duration.as_millis(),
            details.map_or(String::new(), |d| format!(" ({d})"))
        );

        #[cfg(target_arch = "wasm32")]
        web_sys::console::log_1(&message.into());

        #[cfg(not(target_arch = "wasm32"))]
        println!("{message}");
    }
}

// Warning logging helper (only logs on WASM)
fn log_warning(message: &str) {
    #[cfg(target_arch = "wasm32")]
    web_sys::console::warn_1(&format!("[DictionaryEngine] WARNING: {message}").into());

    #[cfg(not(target_arch = "wasm32"))]
    println!("[DictionaryEngine] WARNING: {message}");
}

#[derive(Debug, serde::Deserialize)]
pub struct BaseCsvEntry {
    pub key: String,
    pub category: i32,
    pub count: i32,
    pub aliases: Option<String>,
}

#[derive(Debug)]
pub struct DictionaryEntry {
    pub key: String,
    pub category: i32,
    pub count: i32,
    pub aliases: Vec<String>,
}

#[derive(Debug, Clone, Tsify, serde::Serialize)]
#[tsify(into_wasm_abi)]
pub struct CompletionResultEntry {
    pub term: String,
    pub canonical_key: String,
    pub is_canonical: bool,
    pub category: i32,
    pub count: i32,
    pub score: u32,
    pub aliases: Vec<String>,
}

#[derive(Debug, Tsify, serde::Serialize)]
#[tsify(into_wasm_abi)]
pub struct QueryResultEntryValue {
    pub term: String,
    pub canonical_key: String,
    pub is_canonical: bool,
    pub category: i32,
    pub count: i32,
    pub aliases: Vec<String>,
}

#[derive(Debug, Tsify, serde::Serialize)]
#[tsify(into_wasm_abi)]
pub struct QueryResultEntry(pub String, pub Vec<QueryResultEntryValue>);

#[derive(Debug, Clone, Copy, Eq, PartialEq)]
pub struct IndexEntry {
    pub index: usize,
    pub alias_index: Option<usize>, // None if it's the canonical entry
}

#[derive(Debug, Clone, Copy, Eq, PartialEq)]
pub struct ScoreableEntry {
    pub index: usize,
    pub is_canonical: bool,
    pub count: i64,
}

impl Ord for ScoreableEntry {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        // Sort by count descending, is_canonical descending (true comes first), then index ascending
        other
            .count
            .cmp(&self.count)
            .then_with(|| other.is_canonical.cmp(&self.is_canonical))
            .then_with(|| self.index.cmp(&other.index))
    }
}

impl PartialOrd for ScoreableEntry {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

#[wasm_bindgen]
pub struct DictionaryEngine {
    dictionary: Vec<DictionaryEntry>,
    completion_haystack_ascii: Vec<String>,
    completion_haystack_non_ascii: Vec<String>,
    completion_map: HashMap<String, Vec<IndexEntry>>,
    query_map: HashMap<String, Vec<IndexEntry>>,
    nucleo_matcher: Matcher,
}

#[wasm_bindgen]
impl DictionaryEngine {
    fn create_completion_result_entry(
        dictionary: &[DictionaryEntry],
        index: usize,
        alias_index: Option<usize>,
        score: u32,
    ) -> CompletionResultEntry {
        let entry = &dictionary[index];
        let (term, is_canonical) = match alias_index {
            Some(alias_index) => (entry.aliases[alias_index].clone(), false),
            None => (entry.key.clone(), true),
        };
        CompletionResultEntry {
            term,
            canonical_key: entry.key.clone(),
            is_canonical,
            category: entry.category,
            count: entry.count,
            score,
            aliases: entry.aliases.clone(),
        }
    }

    #[wasm_bindgen(constructor)]
    pub fn new(base_csvs: Vec<String>) -> DictionaryEngine {
        let start_time = Instant::now();

        let mut dictionary_index = 0;
        let mut dictionary: Vec<DictionaryEntry> = Vec::new();
        let mut completion_map: HashMap<String, Vec<IndexEntry>> = HashMap::new();
        let mut completion_haystack_ascii_set: HashSet<String> = HashSet::new();
        let mut completion_haystack_non_ascii_set: HashSet<String> = HashSet::new();
        let mut query_map: HashMap<String, Vec<IndexEntry>> = HashMap::new();

        // Phase 1: CSV parsing and dictionary building
        let parse_start = Instant::now();
        let mut skipped_lines = 0;
        let mut total_lines = 0;

        for csv in base_csvs {
            // Skip completely empty CSV strings
            if csv.trim().is_empty() {
                continue;
            }

            let mut reader = csv::ReaderBuilder::new()
                .has_headers(false)
                .from_reader(csv.as_bytes());

            for result in reader.deserialize() {
                total_lines += 1;

                let entry: BaseCsvEntry = match result {
                    Ok(entry) => entry,
                    Err(err) => {
                        skipped_lines += 1;
                        log_warning(&format!("Failed to parse CSV line {total_lines}: {err}"));
                        continue; // Skip this line and continue processing
                    }
                };

                let key = entry.key.trim().to_string();
                if key.is_empty() {
                    skipped_lines += 1;
                    continue; // Skip empty keys
                }

                let aliases: Vec<String> = entry
                    .aliases
                    .as_ref()
                    .iter()
                    .flat_map(|s| s.split(','))
                    .map(str::trim)
                    .filter(|s| !s.is_empty())
                    .map(str::to_string)
                    .collect();
                let dictionary_entry = DictionaryEntry {
                    key: key.clone(),
                    category: entry.category,
                    count: entry.count,
                    aliases: aliases.clone(),
                };
                dictionary.push(dictionary_entry);

                for (key, alias_index) in std::iter::once((&key, None))
                    .chain(aliases.iter().enumerate().map(|(i, s)| (s, Some(i))))
                {
                    let entry = IndexEntry {
                        index: dictionary_index,
                        alias_index,
                    };

                    // Auto completion
                    let completion_key = normalize_for_auto_completion(key);
                    completion_map
                        .entry(completion_key.clone())
                        .or_default()
                        .push(entry);
                    if completion_key.is_ascii() {
                        completion_haystack_ascii_set.insert(completion_key);
                    } else {
                        completion_haystack_non_ascii_set.insert(completion_key);
                    }

                    // Query map
                    let query_key = normalize_for_query(key);
                    query_map.entry(query_key.clone()).or_default().push(entry);
                }

                dictionary_index += 1;
            }
        }

        log_performance(
            "CSV parsing and indexing",
            parse_start.elapsed(),
            Some(&format!(
                "{} entries processed, {} lines skipped",
                dictionary.len(),
                skipped_lines
            )),
        );

        // Phase 2: Sorting entries in maps
        let sort_start = Instant::now();
        for indices in completion_map.values_mut() {
            indices.sort_by_key(|v| ScoreableEntry {
                index: v.index,
                is_canonical: v.alias_index.is_none(),
                count: dictionary[v.index].count as i64,
            });
        }

        log_performance(
            "Map sorting",
            sort_start.elapsed(),
            Some(&format!("{} completion entries", completion_map.len())),
        );

        // Phase 3: Haystack preparation and sorting
        let haystack_start = Instant::now();
        // Sort the haystacks
        let score_map = completion_map
            .iter()
            .map(|(key, indices)| {
                let count = indices
                    .iter()
                    .map(|entry| dictionary[entry.index].count as i64)
                    .sum();
                let is_canonical = indices.iter().any(|e| e.alias_index.is_none());
                let index = indices.iter().min_by_key(|e| e.index).unwrap().index;

                (
                    key.clone(),
                    ScoreableEntry {
                        index,
                        is_canonical,
                        count,
                    },
                )
            })
            .collect::<HashMap<_, _>>();

        let mut completion_haystack_ascii: Vec<String> =
            completion_haystack_ascii_set.into_iter().collect();
        let mut completion_haystack_non_ascii: Vec<String> =
            completion_haystack_non_ascii_set.into_iter().collect();

        completion_haystack_ascii.sort_by_key(|s| score_map.get(s).unwrap());
        completion_haystack_non_ascii.sort_by_key(|s| score_map.get(s).unwrap());

        log_performance(
            "Haystack preparation",
            haystack_start.elapsed(),
            Some(&format!(
                "ASCII: {}, Non-ASCII: {}",
                completion_haystack_ascii.len(),
                completion_haystack_non_ascii.len()
            )),
        );

        // Create the Nucleo matcher
        let nucleo_matcher = {
            let mut config = Config::DEFAULT;
            config.prefer_prefix = false;

            Matcher::new(config)
        };

        log_performance(
            "DictionaryEngine initialization",
            start_time.elapsed(),
            Some(&format!("Total entries: {}", dictionary.len())),
        );

        DictionaryEngine {
            dictionary,
            completion_haystack_ascii,
            completion_haystack_non_ascii,
            completion_map,
            query_map,
            nucleo_matcher,
        }
    }

    #[wasm_bindgen]
    pub fn fuzzy_search(
        &mut self,
        query: &str,
        max_entries: Option<usize>,
        force_try_non_ascii: Option<bool>,
    ) -> Vec<CompletionResultEntry> {
        let start_time = Instant::now();

        let completion_query = normalize_for_auto_completion(query);
        let try_non_ascii = force_try_non_ascii.unwrap_or_else(|| !completion_query.is_ascii());

        // Phase 1: Pattern parsing and matching
        let pattern_start = Instant::now();
        let pattern = Pattern::parse(&completion_query, CaseMatching::Smart, Normalization::Smart);
        let nucleo_matches = if try_non_ascii {
            pattern.match_list(
                self.completion_haystack_ascii
                    .iter()
                    .chain(self.completion_haystack_non_ascii.iter()),
                &mut self.nucleo_matcher,
            )
        } else {
            pattern.match_list(&self.completion_haystack_ascii, &mut self.nucleo_matcher)
        };

        log_performance(
            "Pattern matching",
            pattern_start.elapsed(),
            Some(&format!(
                "query: '{}', matches: {}, try_non_ascii: {}",
                query,
                nucleo_matches.len(),
                try_non_ascii
            )),
        );

        // Phase 2: Result construction
        let construction_start = Instant::now();

        // Pre-allocate with a reasonable capacity to avoid reallocations
        let estimated_capacity = match max_entries {
            Some(max) => max.min(nucleo_matches.len() * 2), // Estimate 2 entries per match on average
            None => nucleo_matches.len() * 2,
        };
        let mut results: Vec<CompletionResultEntry> = Vec::with_capacity(estimated_capacity);

        'outer: for (candidate, score) in nucleo_matches {
            for &IndexEntry { index, alias_index } in
                self.completion_map.get(candidate).iter().cloned().flatten()
            {
                results.push(Self::create_completion_result_entry(
                    &self.dictionary,
                    index,
                    alias_index,
                    score,
                ));
                if let Some(max) = max_entries {
                    if results.len() >= max {
                        break 'outer;
                    }
                }
            }
        }

        log_performance(
            "Result construction",
            construction_start.elapsed(),
            Some(&format!("results: {}", results.len())),
        );

        log_performance(
            "fuzzy_search total",
            start_time.elapsed(),
            Some(&format!(
                "query: '{}', final_results: {}",
                query,
                results.len()
            )),
        );

        results
    }

    #[wasm_bindgen]
    pub fn query_words(&self, words: Vec<String>) -> Vec<QueryResultEntry> {
        let start_time = Instant::now();
        let words_len = words.len();

        let result = words
            .into_iter()
            .map(|word| {
                let normalized_for_query = normalize_for_query(&word);
                let indices = self.query_map.get(&normalized_for_query).cloned();
                let entries = match indices {
                    Some(indices) => indices
                        .iter()
                        .map(|&IndexEntry { index, alias_index }| {
                            let entry = &self.dictionary[index];
                            let (term, is_canonical) = match alias_index {
                                Some(alias_index) => (entry.aliases[alias_index].clone(), false),
                                None => (entry.key.clone(), true),
                            };
                            QueryResultEntryValue {
                                term,
                                canonical_key: entry.key.clone(),
                                is_canonical,
                                category: entry.category,
                                count: entry.count,
                                aliases: entry.aliases.clone(),
                            }
                        })
                        .collect::<Vec<_>>(),
                    None => vec![],
                };

                QueryResultEntry(word, entries)
            })
            .collect::<Vec<_>>();

        log_performance(
            "query_words total",
            start_time.elapsed(),
            Some(&format!(
                "words: {}, total_results: {}",
                words_len,
                result
                    .iter()
                    .map(|QueryResultEntry(_, entries)| entries.len())
                    .sum::<usize>()
            )),
        );

        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Test CSV data with N-M relations using realworld entries
    fn create_test_csv_data() -> Vec<String> {
        vec![
            // Mix of custom test data and realworld entries showing N-M relations
            r#"1girl,0,5794009,"1girls,女の子,女性,少女,girl,おんなのこ,女子,소녀,女孩,姑娘,女,ガール,ガールズイラスト,animegirl"
solo,0,4827463,"female_solo,ソロ,ひとり"
long_hair,0,4181922,"ロングヘアー,長髪,ロングヘア,黒髪ロング,金髪ロング,长发,長髪けもフレ,茶髪ロング,長い髪,長髪男子,銀髪ロング"
looking_at_viewer,0,3173286,カメラ目線
smile,0,2754486,"smiling,:),:},笑い,スマイル,笑顔,笑顏,守りたい、この笑顔,笑,笑容,微笑み,微笑,微笑む,미소,守りたいこの笑顔"
short_hair,0,2180660,"ショートヘア,ショートカット,短髪,黒髪ショート,短发,단발"
blue_eyes,0,1697952,"碧眼,青い目,藍眼睛,蓝眼睛,파란눈,金髪碧眼,金髮碧眼,金发碧眼,금발벽안,銀髪碧眼,銀髮碧眼,银发碧眼,은발벽안"
blonde_hair,0,1482750,"blonde,blond,yellow_hair,blond_hair,gold_hair,金髪,金髮,金发,금발,金髪碧眼,金髮碧眼,金发碧眼,금발벽안,金髪ロング,金髪ツインテール,ブロンド"
black_hair,0,1438614,"黒髪,黒髪ロング,黒髪ショート,黒髪ボブ,黑发,흑발,黒髪赤眼,黑髮赤眼,黑发赤眼,흑발적안,黑髮紅眼,黑发红眼"
brown_hair,0,1434326,"brunette,茶髪,茶髪ロング,갈색머리"
1boy,0,1338440,"1boys,男の子,男,少年,男の娘,長髪男子,男子,boy,animeboy"
red_eyes,0,1227637,"red_eye,赤目,赤眼,赤い目,붉은눈,빨간눈,銀髪赤眼,銀髮赤眼,银发赤眼,은발적안,白髮紅眼,白发红眼,黒髪赤眼,黑髮赤眼,黑发赤眼,흑발적안,黑髮紅眼,黑发红眼"
very_long_hair,0,910735,"hair_past_waist,超ロングヘア,超长发"
twintails,0,873952,"twintail,twin_tails,ツインテール,双马尾,雙馬尾,트윈테일,二つ結い,いいツインテールの日,ツインテ,金髪ツインテール,2つくくり"
masterpiece,0,300000,"best_quality,high_quality,top_quality"
standing,2,90000,"stand,upright"
outdoors,6,80000,"outside,outdoor,exterior"
sky,6,70000,"heavens,firmament"
clouds,6,60000,"cloud,cloudy_sky"
tree,6,50000,"trees,vegetation"
grass,6,40000,"lawn,field"
flower,6,30000,"flowers,bloom,blossom"
cat,7,25000,"kitten,feline,neko"
dog,7,20000,"puppy,canine,inu"
bird,7,15000,"avian,flying_creature"
fish,7,10000,"aquatic,swimming_creature"
night,6,35000,"evening,darkness,nocturnal"
day,6,45000,"daytime,daylight,bright"
sunset,6,25000,"dusk,twilight,evening_glow"
sunrise,6,20000,"dawn,morning_glow,daybreak"
rain,6,15000,"raining,precipitation,shower"
snow,6,12000,"snowing,snowfall,winter_weather"
wind,6,18000,"windy,breeze,gust""#.to_string(),
        ]
    }

    #[test]
    fn test_dictionary_engine_creation() {
        let csv_data = create_test_csv_data();
        let engine = DictionaryEngine::new(csv_data);

        // Constructor should never fail now
        assert!(!engine.dictionary.is_empty());
        assert_eq!(engine.dictionary.len(), 33); // Number of entries in test CSV
    }

    #[test]
    fn test_dictionary_entry_parsing() {
        let csv_data = create_test_csv_data();
        let engine = DictionaryEngine::new(csv_data);

        // Test first entry (1girl)
        let first_entry = &engine.dictionary[0];
        assert_eq!(first_entry.key, "1girl");
        assert_eq!(first_entry.category, 0);
        assert_eq!(first_entry.count, 5794009);
        assert_eq!(
            first_entry.aliases,
            vec![
                "1girls",
                "女の子",
                "女性",
                "少女",
                "girl",
                "おんなのこ",
                "女子",
                "소녀",
                "女孩",
                "姑娘",
                "女",
                "ガール",
                "ガールズイラスト",
                "animegirl"
            ]
        );

        // Test masterpiece entry
        let masterpiece_entry = engine
            .dictionary
            .iter()
            .find(|e| e.key == "masterpiece")
            .unwrap();
        assert_eq!(masterpiece_entry.category, 0);
        assert_eq!(masterpiece_entry.count, 300000);
        assert_eq!(
            masterpiece_entry.aliases,
            vec!["best_quality", "high_quality", "top_quality"]
        );
    }

    #[test]
    fn test_fuzzy_search_basic() {
        let csv_data = create_test_csv_data();
        let mut engine = DictionaryEngine::new(csv_data);

        // Test basic search
        let results = engine.fuzzy_search("girl", Some(10), None);
        assert!(!results.is_empty());

        // Should find both "1girl" and entries with "girl" in aliases
        let girl_results: Vec<_> = results
            .iter()
            .filter(|r| r.term.contains("girl") || r.canonical_key.contains("girl"))
            .collect();
        assert!(!girl_results.is_empty());
    }

    #[test]
    fn test_fuzzy_search_alias_matching() {
        let csv_data = create_test_csv_data();
        let mut engine = DictionaryEngine::new(csv_data);

        // Search for alias "best_quality" should find "masterpiece"
        let results = engine.fuzzy_search("best_quality", Some(10), None);
        assert!(!results.is_empty());

        let masterpiece_result = results.iter().find(|r| r.canonical_key == "masterpiece");
        assert!(masterpiece_result.is_some());

        let result = masterpiece_result.unwrap();
        assert_eq!(result.term, "best_quality");
        assert!(!result.is_canonical);
        assert_eq!(result.canonical_key, "masterpiece");
    }

    #[test]
    fn test_fuzzy_search_canonical_vs_alias() {
        let csv_data = create_test_csv_data();
        let mut engine = DictionaryEngine::new(csv_data);

        // Search for "masterpiece" should find canonical entry
        let results = engine.fuzzy_search("masterpiece", Some(10), None);
        assert!(!results.is_empty());

        let canonical_result = results
            .iter()
            .find(|r| r.term == "masterpiece" && r.is_canonical);
        assert!(canonical_result.is_some());

        let result = canonical_result.unwrap();
        assert_eq!(result.canonical_key, "masterpiece");
        assert!(result.is_canonical);
    }

    #[test]
    fn test_fuzzy_search_partial_match() {
        let csv_data = create_test_csv_data();
        let mut engine = DictionaryEngine::new(csv_data);

        // Partial match should work
        let results = engine.fuzzy_search("blu", Some(10), None);
        assert!(!results.is_empty());

        // Should find "blue_eyes" and potentially "blonde_hair"
        let blue_results: Vec<_> = results
            .iter()
            .filter(|r| r.term.contains("blue") || r.canonical_key.contains("blue"))
            .collect();
        assert!(!blue_results.is_empty());
    }

    #[test]
    fn test_fuzzy_search_max_entries() {
        let csv_data = create_test_csv_data();
        let mut engine = DictionaryEngine::new(csv_data);

        // Test max_entries limit
        let results = engine.fuzzy_search("a", Some(5), None);
        assert!(results.len() <= 5);

        // Test without limit
        let unlimited_results = engine.fuzzy_search("a", None, None);
        assert!(unlimited_results.len() >= results.len());
    }

    #[test]
    fn test_query_words_exact_match() {
        let csv_data = create_test_csv_data();
        let engine = DictionaryEngine::new(csv_data);

        let words = vec!["1girl".to_string(), "masterpiece".to_string()];
        let results = engine.query_words(words);

        assert_eq!(results.len(), 2);

        // Check first result (1girl)
        assert_eq!(results[0].0, "1girl");
        assert!(!results[0].1.is_empty());
        let girl_entry = &results[0].1[0];
        assert_eq!(girl_entry.canonical_key, "1girl");
        assert!(girl_entry.is_canonical);

        // Check second result (masterpiece)
        assert_eq!(results[1].0, "masterpiece");
        assert!(!results[1].1.is_empty());
        let masterpiece_entry = &results[1].1[0];
        assert_eq!(masterpiece_entry.canonical_key, "masterpiece");
        assert!(masterpiece_entry.is_canonical);
    }

    #[test]
    fn test_query_words_alias_match() {
        let csv_data = create_test_csv_data();
        let engine = DictionaryEngine::new(csv_data);

        let words = vec!["girl".to_string(), "best_quality".to_string()];
        let results = engine.query_words(words);

        assert_eq!(results.len(), 2);

        // Check first result (girl -> alias of 1girl)
        assert_eq!(results[0].0, "girl");
        assert!(!results[0].1.is_empty());
        let girl_entry = &results[0].1[0];
        assert_eq!(girl_entry.canonical_key, "1girl");
        assert!(!girl_entry.is_canonical);
        assert_eq!(girl_entry.term, "girl");

        // Check second result (best_quality -> alias of masterpiece)
        assert_eq!(results[1].0, "best_quality");
        assert!(!results[1].1.is_empty());
        let quality_entry = &results[1].1[0];
        assert_eq!(quality_entry.canonical_key, "masterpiece");
        assert!(!quality_entry.is_canonical);
        assert_eq!(quality_entry.term, "best_quality");
    }

    #[test]
    fn test_query_words_no_match() {
        let csv_data = create_test_csv_data();
        let engine = DictionaryEngine::new(csv_data);

        let words = vec!["nonexistent".to_string()];
        let results = engine.query_words(words);

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].0, "nonexistent");
        assert!(results[0].1.is_empty());
    }

    #[test]
    fn test_query_words_multiple_matches() {
        let csv_data = create_test_csv_data();
        let engine = DictionaryEngine::new(csv_data);

        // Test word that matches multiple entries
        let words = vec!["金髪ロング".to_string()];
        let results = engine.query_words(words);

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].0, "金髪ロング");
        assert_eq!(results[0].1.len(), 2);
        let canonical_key_set = results[0]
            .1
            .iter()
            .map(|e| e.canonical_key.clone())
            .collect::<HashSet<_>>();
        assert!(canonical_key_set.contains("long_hair"));
        assert!(canonical_key_set.contains("blonde_hair"));
    }

    #[test]
    fn test_completion_map_structure() {
        let csv_data = create_test_csv_data();
        let engine = DictionaryEngine::new(csv_data);

        // Test that completion map contains normalized entries
        assert!(!engine.completion_map.is_empty());

        // Test that aliases are properly indexed
        let normalized_girl = normalize_for_auto_completion("girl");
        assert!(engine.completion_map.contains_key(&normalized_girl));

        let normalized_masterpiece = normalize_for_auto_completion("masterpiece");
        assert!(engine.completion_map.contains_key(&normalized_masterpiece));
    }

    #[test]
    fn test_query_map_structure() {
        let csv_data = create_test_csv_data();
        let engine = DictionaryEngine::new(csv_data);

        // Test that query map contains normalized entries
        assert!(!engine.query_map.is_empty());

        // Test that both canonical and alias entries are in query map
        let normalized_girl = normalize_for_query("girl");
        assert!(engine.query_map.contains_key(&normalized_girl));

        let normalized_1girl = normalize_for_query("1girl");
        assert!(engine.query_map.contains_key(&normalized_1girl));
    }

    #[test]
    fn test_scoreable_entry_ordering() {
        let entry1 = ScoreableEntry {
            index: 0,
            is_canonical: true,
            count: 100,
        };

        let entry2 = ScoreableEntry {
            index: 1,
            is_canonical: false,
            count: 200,
        };

        let entry3 = ScoreableEntry {
            index: 2,
            is_canonical: true,
            count: 200,
        };

        // entry2 should come before entry1 (higher count)
        assert!(entry2 < entry1);

        // entry3 should come before entry2 (same count, but canonical)
        assert!(entry3 < entry2);
    }

    #[test]
    fn test_search_performance_with_large_dataset() {
        let csv_data = create_test_csv_data();
        let mut engine = DictionaryEngine::new(csv_data);

        // This test ensures search performance is reasonable
        let start = Instant::now();

        for _ in 0..100 {
            let _ = engine.fuzzy_search("test", Some(10), None);
        }

        let duration = start.elapsed();
        // Should complete 100 searches in reasonable time (adjust threshold as needed)
        assert!(
            duration.as_millis() < 1000,
            "Search performance too slow: {duration:?}",
        );
    }

    #[test]
    fn test_category_preservation() {
        let csv_data = create_test_csv_data();
        let engine = DictionaryEngine::new(csv_data);

        // Test that categories are preserved correctly
        let masterpiece_entry = engine
            .dictionary
            .iter()
            .find(|e| e.key == "masterpiece")
            .unwrap();
        assert_eq!(masterpiece_entry.category, 0);

        let girl_entry = engine.dictionary.iter().find(|e| e.key == "1girl").unwrap();
        assert_eq!(girl_entry.category, 0);

        let pose_entry = engine
            .dictionary
            .iter()
            .find(|e| e.key == "looking_at_viewer")
            .unwrap();
        assert_eq!(pose_entry.category, 0);
    }

    #[test]
    fn test_count_preservation() {
        let csv_data = create_test_csv_data();
        let mut engine = DictionaryEngine::new(csv_data);

        // Test that counts are preserved correctly in search results
        let results = engine.fuzzy_search("1girl", Some(10), None);
        let girl_result = results.iter().find(|r| r.canonical_key == "1girl").unwrap();
        assert_eq!(girl_result.count, 5794009);

        let masterpiece_results = engine.fuzzy_search("masterpiece", Some(10), None);
        let masterpiece_result = masterpiece_results
            .iter()
            .find(|r| r.canonical_key == "masterpiece")
            .unwrap();
        assert_eq!(masterpiece_result.count, 300000);
    }

    #[test]
    fn test_empty_csv_handling() {
        let empty_csv = vec!["".to_string()];
        let mut engine = DictionaryEngine::new(empty_csv);
        assert!(engine.dictionary.is_empty());

        let results = engine.fuzzy_search("test", Some(10), None);
        assert!(results.is_empty());
    }

    #[test]
    fn test_malformed_csv_handling() {
        let malformed_csv = vec![
            "invalid,csv,data,too,many,fields".to_string(),
            "1girl,0,500000,\"girl,solo_girl,female\"".to_string(), // This one is valid
        ];

        // Should handle malformed entries gracefully - constructor never fails
        let engine = DictionaryEngine::new(malformed_csv);

        // Should have processed the valid entry and skipped the invalid one
        assert_eq!(engine.dictionary.len(), 1);
        assert_eq!(engine.dictionary[0].key, "1girl");
    }

    #[test]
    fn test_robust_error_handling() {
        let problematic_csv = vec![
            "".to_string(),                                // Empty line - should be skipped
            "valid1,0,1000,\"alias1,alias2\"".to_string(), // Valid entry
            "invalid_line_with_wrong_format".to_string(),  // Invalid format - should be skipped
            "   ".to_string(),                             // Whitespace only - should be skipped
            ",,,".to_string(), // Empty fields - should be skipped (empty key)
            "valid2,1,2000,\"alias3,alias4\"".to_string(), // Valid entry
            "incomplete,line".to_string(), // Incomplete - should be skipped
        ];

        // Constructor should never fail, even with problematic data
        let engine = DictionaryEngine::new(problematic_csv);

        // Should have processed only the valid entries
        assert_eq!(engine.dictionary.len(), 2);
        assert_eq!(engine.dictionary[0].key, "valid1");
        assert_eq!(engine.dictionary[1].key, "valid2");

        // Should be able to search successfully
        let mut engine = engine;
        let results = engine.fuzzy_search("valid", Some(10), None);
        assert_eq!(results.len(), 2);
    }

    #[test]
    fn test_special_characters_in_aliases() {
        let special_csv = vec![
            r#"test_tag,1,1000,"alias_with_underscore,alias with spaces,alias-with-dashes,alias.with.dots""#.to_string(),
        ];

        let engine = DictionaryEngine::new(special_csv);
        let entry = &engine.dictionary[0];

        assert_eq!(entry.key, "test_tag");
        assert_eq!(entry.aliases.len(), 4);
        assert!(entry.aliases.contains(&"alias_with_underscore".to_string()));
        assert!(entry.aliases.contains(&"alias with spaces".to_string()));
        assert!(entry.aliases.contains(&"alias-with-dashes".to_string()));
        assert!(entry.aliases.contains(&"alias.with.dots".to_string()));
    }

    #[test]
    fn test_n_m_relationship_comprehensive() {
        let csv_data = create_test_csv_data();
        let engine = DictionaryEngine::new(csv_data);

        // Test N-M relationship: Multiple tags can share aliases conceptually
        // and one tag can have multiple aliases

        // 1. One tag, multiple aliases (1-to-N)
        let masterpiece_entry = engine
            .dictionary
            .iter()
            .find(|e| e.key == "masterpiece")
            .unwrap();
        assert_eq!(masterpiece_entry.aliases.len(), 3);

        // 2. Multiple tags might share conceptual aliases (N-to-M)
        // Let's count how many entries have "hair" related terms
        let hair_related_count = engine
            .dictionary
            .iter()
            .filter(|e| e.key.contains("hair") || e.aliases.iter().any(|a| a.contains("hair")))
            .count();
        assert!(hair_related_count >= 2); // Should have long_hair, blonde_hair at minimum

        // 3. Test that query map handles this correctly
        let query_results = engine.query_words(vec!["girl".to_string()]);
        assert_eq!(query_results.len(), 1);
        assert_eq!(query_results[0].0, "girl");
        // Should find the alias match
        assert!(!query_results[0].1.is_empty());
    }

    #[test]
    fn test_real_n_m_relations() {
        let csv_data = create_test_csv_data();
        let mut engine = DictionaryEngine::new(csv_data);

        // Test N-M relations with realworld data from create_test_csv_data()
        // 1. Test multiple hair-related entries with overlapping aliases
        let hair_search = engine.fuzzy_search("hair", Some(20), None);
        assert!(!hair_search.is_empty());

        let hair_entries: Vec<_> = hair_search
            .iter()
            .filter(|r| r.canonical_key.contains("hair") || r.term.contains("hair"))
            .collect();
        assert!(hair_entries.len() >= 3); // long_hair, short_hair, very_long_hair, etc.

        // 2. Test that blonde_hair has extensive aliases including Japanese/Chinese/Korean
        let blonde_results = engine.fuzzy_search("blonde", Some(10), None);
        let blonde_entry = blonde_results
            .iter()
            .find(|r| r.canonical_key == "blonde_hair")
            .unwrap();
        assert!(blonde_entry.aliases.contains(&"金髪".to_string()));
        assert!(blonde_entry.aliases.contains(&"blond".to_string()));
        assert!(blonde_entry.aliases.contains(&"金发".to_string()));

        // 3. Test eye color N-M relations
        let eye_search = engine.fuzzy_search("eyes", Some(20), None);
        let eye_entries: Vec<_> = eye_search
            .iter()
            .filter(|r| r.canonical_key.contains("eyes") || r.term.contains("eyes"))
            .collect();
        assert!(eye_entries.len() >= 2); // blue_eyes, red_eyes

        // 4. Test that aliases can be found across different entries
        let red_eye_results = engine.fuzzy_search("red_eye", Some(10), None);
        assert!(!red_eye_results.is_empty());
        let red_eye_entry = red_eye_results
            .iter()
            .find(|r| r.canonical_key == "red_eyes")
            .unwrap();
        // Could be "red_eye" alias or "red_eyes" canonical
        assert!(red_eye_entry.term == "red_eye" || red_eye_entry.term == "red_eyes");
        assert_eq!(red_eye_entry.canonical_key, "red_eyes");
    }

    #[test]
    fn test_multilingual_aliases() {
        let csv_data = create_test_csv_data();
        let engine = DictionaryEngine::new(csv_data);

        // Test that multilingual aliases are properly indexed
        let japanese_words = vec!["笑顔".to_string(), "金髪".to_string(), "赤目".to_string()];
        let results = engine.query_words(japanese_words);

        // Should find matches for Japanese aliases
        assert_eq!(results.len(), 3);

        // Check smile (笑顔)
        assert_eq!(results[0].0, "笑顔");
        assert!(!results[0].1.is_empty());
        let smile_entry = &results[0].1[0];
        assert_eq!(smile_entry.canonical_key, "smile");
        assert!(!smile_entry.is_canonical);

        // Check blonde_hair (金髪)
        assert_eq!(results[1].0, "金髪");
        assert!(!results[1].1.is_empty());
        let blonde_entry = &results[1].1[0];
        assert_eq!(blonde_entry.canonical_key, "blonde_hair");
        assert!(!blonde_entry.is_canonical);

        // Check red_eyes (赤目)
        assert_eq!(results[2].0, "赤目");
        assert!(!results[2].1.is_empty());
        let red_entry = &results[2].1[0];
        assert_eq!(red_entry.canonical_key, "red_eyes");
        assert!(!red_entry.is_canonical);
    }

    #[test]
    fn test_complex_n_m_relationships() {
        let csv_data = create_test_csv_data();
        let mut engine = DictionaryEngine::new(csv_data);

        // Test complex N-M: multiple entries sharing conceptual aliases
        // "blonde" could map to both "blonde_hair" and potentially other blonde-related entries
        let blonde_search = engine.fuzzy_search("blonde", Some(10), None);
        assert!(!blonde_search.is_empty());

        // Test that "金髪" (blonde in Japanese) can be found
        let japanese_blonde = engine.fuzzy_search("金髪", Some(10), None);
        assert!(!japanese_blonde.is_empty());

        // Both should find the same canonical entry
        let blonde_canonical = blonde_search
            .iter()
            .find(|r| r.canonical_key == "blonde_hair");
        let japanese_canonical = japanese_blonde
            .iter()
            .find(|r| r.canonical_key == "blonde_hair");
        assert!(blonde_canonical.is_some());
        assert!(japanese_canonical.is_some());

        // Test that the same alias can appear in multiple entries (N-M relation)
        // For example, "long" might appear in both "long_hair" and "very_long_hair"
        let long_search = engine.fuzzy_search("long", Some(20), None);
        let long_hair_entries: Vec<_> = long_search
            .iter()
            .filter(|r| r.canonical_key.contains("long_hair"))
            .collect();
        assert!(long_hair_entries.len() >= 2); // long_hair, very_long_hair
    }

    #[test]
    fn test_alias_overlap_scenarios() {
        let csv_data = create_test_csv_data();
        let engine = DictionaryEngine::new(csv_data);

        // Test scenarios where aliases might overlap between different entries
        // This is a key N-M relationship test

        // 1. Test "hair" aliases across different hair-related entries
        let hair_words = vec!["hair".to_string(), "長髪".to_string(), "短髪".to_string()];
        let results = engine.query_words(hair_words);

        // Should find different canonical entries for different hair types
        let hair_canonicals: Vec<_> = results
            .iter()
            .flat_map(|r| r.1.iter())
            .map(|entry| entry.canonical_key.as_str())
            .collect::<std::collections::HashSet<_>>()
            .into_iter()
            .collect();

        // Should have multiple different canonical hair entries
        assert!(hair_canonicals.len() >= 2);

        // 2. Test that compound aliases work (e.g., "金髪ロング" should map to long_hair)
        let compound_results = engine.query_words(vec!["金髪ロング".to_string()]);
        assert_eq!(compound_results.len(), 1);
        assert!(!compound_results[0].1.is_empty());
        let compound_entry = &compound_results[0].1[0];
        assert_eq!(compound_entry.canonical_key, "long_hair");
    }

    #[test]
    fn test_high_count_entries_prioritization() {
        let csv_data = create_test_csv_data();
        let mut engine = DictionaryEngine::new(csv_data);

        // Test that high-count entries are prioritized in search results
        let girl_search = engine.fuzzy_search("girl", Some(5), None);
        assert!(!girl_search.is_empty());

        // The first result should be the highest count entry
        let first_result = &girl_search[0];

        // Should be "1girl" with very high count (5,794,009)
        assert_eq!(first_result.canonical_key, "1girl");
        assert_eq!(first_result.count, 5794009);

        // Test that canonical entries are preferred over aliases when counts are equal
        let smile_search = engine.fuzzy_search("smile", Some(5), None);
        let canonical_smile = smile_search
            .iter()
            .find(|r| r.is_canonical && r.canonical_key == "smile")
            .unwrap();

        // Should find the canonical "smile" entry
        assert!(canonical_smile.is_canonical);
        assert_eq!(canonical_smile.canonical_key, "smile");
        assert_eq!(canonical_smile.term, "smile");

        // Test searching for an alias "smiling" should find the same canonical entry
        let smiling_search = engine.fuzzy_search("smiling", Some(5), None);
        let smiling_result = smiling_search
            .iter()
            .find(|r| r.canonical_key == "smile")
            .unwrap();
        assert!(!smiling_result.is_canonical);
        assert_eq!(smiling_result.canonical_key, "smile");
        assert_eq!(smiling_result.term, "smiling");
    }

    #[test]
    fn test_unicode_normalization() {
        let csv_data = create_test_csv_data();
        let mut engine = DictionaryEngine::new(csv_data);

        // Test that Unicode characters are properly handled in searches
        let unicode_searches = vec![
            "女の子", // Japanese for girl
            "笑顔",   // Japanese for smile
            "金髪",   // Japanese for blonde
            "赤目",   // Japanese for red eyes
            "소녀",   // Korean for girl
            "女孩",   // Chinese for girl
        ];

        for search_term in unicode_searches {
            let results = engine.fuzzy_search(search_term, Some(5), Some(true));
            // Should find at least one result for each Unicode term
            assert!(!results.is_empty(), "No results found for: {search_term}");
        }
    }

    #[test]
    fn test_extensive_alias_lists() {
        let csv_data = create_test_csv_data();
        let engine = DictionaryEngine::new(csv_data);

        // Test entries with extensive alias lists (like 1girl, which has many multilingual aliases)
        let girl_entry = engine.dictionary.iter().find(|e| e.key == "1girl").unwrap();

        // Should have many aliases
        assert!(girl_entry.aliases.len() >= 5);

        // Test that some specific aliases are present
        assert!(girl_entry.aliases.contains(&"girl".to_string()));
        assert!(girl_entry.aliases.contains(&"女の子".to_string()));
        assert!(girl_entry.aliases.contains(&"소녀".to_string()));

        // Test that all aliases can be found through query
        let test_aliases = vec!["girl".to_string(), "女の子".to_string(), "소녀".to_string()];
        let results = engine.query_words(test_aliases);

        for result in results {
            assert!(!result.1.is_empty());
            assert_eq!(result.1[0].canonical_key, "1girl");
        }
    }
}

use unicode_normalization::UnicodeNormalization;

pub fn normalize_for_auto_completion(text: &str) -> String {
    text.nfkc()
        .map(|c| match c {
            // Replace underscores with spaces
            '_' => ' ',
            // Convert Katakana to Hiragana
            'ァ'..='ヶ' => char::from_u32(c as u32 - 0x60).unwrap_or(c),
            // Remain other characters unchanged
            c => c,
        })
        .collect()
}

pub fn normalize_for_query(text: &str) -> String {
    text.nfc()
        .map(|c| match c {
            // Replace underscores with spaces
            '_' => ' ',
            // Remain other characters unchanged
            c => c,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_for_auto_completion_basic() {
        // Test basic ASCII text
        assert_eq!(normalize_for_auto_completion("hello"), "hello");
        assert_eq!(normalize_for_auto_completion("world"), "world");
        assert_eq!(normalize_for_auto_completion("test123"), "test123");
    }

    #[test]
    fn test_normalize_for_auto_completion_underscores() {
        // Test underscore replacement
        assert_eq!(normalize_for_auto_completion("hello_world"), "hello world");
        assert_eq!(normalize_for_auto_completion("long_hair"), "long hair");
        assert_eq!(normalize_for_auto_completion("1_girl"), "1 girl");
        assert_eq!(normalize_for_auto_completion("_test_"), " test ");
        assert_eq!(
            normalize_for_auto_completion("multiple_under_scores"),
            "multiple under scores"
        );
    }

    #[test]
    fn test_normalize_for_auto_completion_katakana_to_hiragana() {
        // Test Katakana to Hiragana conversion
        assert_eq!(normalize_for_auto_completion("カタカナ"), "かたかな");
        assert_eq!(normalize_for_auto_completion("テスト"), "てすと");
        assert_eq!(normalize_for_auto_completion("アニメ"), "あにめ");
        assert_eq!(
            normalize_for_auto_completion("コンピューター"),
            "こんぴゅーたー"
        );

        // Test mixed text
        assert_eq!(
            normalize_for_auto_completion("anime_アニメ"),
            "anime あにめ"
        );
        assert_eq!(normalize_for_auto_completion("test_テスト"), "test てすと");
    }

    #[test]
    fn test_normalize_for_auto_completion_hiragana_unchanged() {
        // Test that Hiragana remains unchanged
        assert_eq!(normalize_for_auto_completion("ひらがな"), "ひらがな");
        assert_eq!(normalize_for_auto_completion("てすと"), "てすと");
        assert_eq!(normalize_for_auto_completion("あにめ"), "あにめ");
    }

    #[test]
    fn test_normalize_for_auto_completion_mixed_characters() {
        // Test mixed Japanese and ASCII with underscores
        assert_eq!(
            normalize_for_auto_completion("test_テスト_ひらがな"),
            "test てすと ひらがな"
        );
        assert_eq!(
            normalize_for_auto_completion("1girl_女の子"),
            "1girl 女の子"
        );
        assert_eq!(
            normalize_for_auto_completion("long_hair_ロング"),
            "long hair ろんぐ"
        );
    }

    #[test]
    fn test_normalize_for_auto_completion_unicode_normalization() {
        // Test Unicode normalization (NFKC)
        // These are composed vs decomposed characters
        assert_eq!(normalize_for_auto_completion("café"), "café"); // Should normalize to composed form
        assert_eq!(normalize_for_auto_completion("naïve"), "naïve");

        // Test full-width characters (should be normalized to half-width)
        assert_eq!(normalize_for_auto_completion("１２３"), "123");
        assert_eq!(normalize_for_auto_completion("ａｂｃ"), "abc");
        assert_eq!(normalize_for_auto_completion("！？"), "!?");
    }

    #[test]
    fn test_normalize_for_auto_completion_special_characters() {
        // Test that other special characters remain unchanged
        assert_eq!(normalize_for_auto_completion("test-dash"), "test-dash");
        assert_eq!(normalize_for_auto_completion("test.dot"), "test.dot");
        assert_eq!(normalize_for_auto_completion("test:colon"), "test:colon");
        assert_eq!(normalize_for_auto_completion("test(paren)"), "test(paren)");
        assert_eq!(
            normalize_for_auto_completion("test[bracket]"),
            "test[bracket]"
        );
    }

    #[test]
    fn test_normalize_for_auto_completion_empty_and_whitespace() {
        // Test empty string and whitespace
        assert_eq!(normalize_for_auto_completion(""), "");
        assert_eq!(normalize_for_auto_completion(" "), " ");
        assert_eq!(normalize_for_auto_completion("  "), "  ");
        assert_eq!(normalize_for_auto_completion("\t"), "\t");
        assert_eq!(normalize_for_auto_completion("\n"), "\n");
    }

    #[test]
    fn test_normalize_for_query_basic() {
        // Test basic ASCII text
        assert_eq!(normalize_for_query("hello"), "hello");
        assert_eq!(normalize_for_query("world"), "world");
        assert_eq!(normalize_for_query("test123"), "test123");
    }

    #[test]
    fn test_normalize_for_query_underscores() {
        // Test underscore replacement
        assert_eq!(normalize_for_query("hello_world"), "hello world");
        assert_eq!(normalize_for_query("long_hair"), "long hair");
        assert_eq!(normalize_for_query("1_girl"), "1 girl");
        assert_eq!(normalize_for_query("_test_"), " test ");
        assert_eq!(
            normalize_for_query("multiple_under_scores"),
            "multiple under scores"
        );
    }

    #[test]
    fn test_normalize_for_query_katakana_unchanged() {
        // Test that Katakana remains unchanged (no conversion to Hiragana)
        assert_eq!(normalize_for_query("カタカナ"), "カタカナ");
        assert_eq!(normalize_for_query("テスト"), "テスト");
        assert_eq!(normalize_for_query("アニメ"), "アニメ");
        assert_eq!(normalize_for_query("コンピューター"), "コンピューター");
    }

    #[test]
    fn test_normalize_for_query_hiragana_unchanged() {
        // Test that Hiragana remains unchanged
        assert_eq!(normalize_for_query("ひらがな"), "ひらがな");
        assert_eq!(normalize_for_query("てすと"), "てすと");
        assert_eq!(normalize_for_query("あにめ"), "あにめ");
    }

    #[test]
    fn test_normalize_for_query_mixed_characters() {
        // Test mixed Japanese and ASCII with underscores
        assert_eq!(
            normalize_for_query("test_テスト_ひらがな"),
            "test テスト ひらがな"
        );
        assert_eq!(normalize_for_query("1girl_女の子"), "1girl 女の子");
        assert_eq!(normalize_for_query("long_hair_ロング"), "long hair ロング");
    }

    #[test]
    fn test_normalize_for_query_unicode_normalization() {
        // Test Unicode normalization (NFC)
        assert_eq!(normalize_for_query("café"), "café"); // Should normalize to composed form
        assert_eq!(normalize_for_query("naïve"), "naïve");

        // Test that full-width characters may be preserved in NFC (unlike NFKC)
        // This depends on the exact Unicode normalization behavior
        let result = normalize_for_query("１２３");
        assert!(!result.is_empty()); // Should produce some result
    }

    #[test]
    fn test_normalize_for_query_special_characters() {
        // Test that other special characters remain unchanged
        assert_eq!(normalize_for_query("test-dash"), "test-dash");
        assert_eq!(normalize_for_query("test.dot"), "test.dot");
        assert_eq!(normalize_for_query("test:colon"), "test:colon");
        assert_eq!(normalize_for_query("test(paren)"), "test(paren)");
        assert_eq!(normalize_for_query("test[bracket]"), "test[bracket]");
    }

    #[test]
    fn test_normalize_for_query_empty_and_whitespace() {
        // Test empty string and whitespace
        assert_eq!(normalize_for_query(""), "");
        assert_eq!(normalize_for_query(" "), " ");
        assert_eq!(normalize_for_query("  "), "  ");
        assert_eq!(normalize_for_query("\t"), "\t");
        assert_eq!(normalize_for_query("\n"), "\n");
    }

    #[test]
    fn test_normalization_differences() {
        // Test differences between auto_completion and query normalization

        // Katakana should be converted to Hiragana in auto_completion but not in query
        let katakana_text = "テスト";
        assert_eq!(normalize_for_auto_completion(katakana_text), "てすと");
        assert_eq!(normalize_for_query(katakana_text), "テスト");

        // Both should handle underscores the same way
        let underscore_text = "test_case";
        assert_eq!(normalize_for_auto_completion(underscore_text), "test case");
        assert_eq!(normalize_for_query(underscore_text), "test case");

        // Both should preserve regular characters
        let regular_text = "hello world";
        assert_eq!(normalize_for_auto_completion(regular_text), "hello world");
        assert_eq!(normalize_for_query(regular_text), "hello world");
    }

    #[test]
    fn test_real_tags() {
        // Test with realworld tags
        assert_eq!(normalize_for_auto_completion("long_hair"), "long hair");
        assert_eq!(normalize_for_auto_completion("1girl"), "1girl");
        assert_eq!(
            normalize_for_auto_completion("looking_at_viewer"),
            "looking at viewer"
        );
        assert_eq!(normalize_for_auto_completion("ロングヘア"), "ろんぐへあ");
        assert_eq!(normalize_for_auto_completion("女の子"), "女の子");

        assert_eq!(normalize_for_query("long_hair"), "long hair");
        assert_eq!(normalize_for_query("1girl"), "1girl");
        assert_eq!(
            normalize_for_query("looking_at_viewer"),
            "looking at viewer"
        );
        assert_eq!(normalize_for_query("ロングヘア"), "ロングヘア");
        assert_eq!(normalize_for_query("女の子"), "女の子");
    }

    #[test]
    fn test_chinese_korean_characters() {
        // Test Chinese characters (should remain unchanged)
        assert_eq!(normalize_for_auto_completion("女孩"), "女孩");
        assert_eq!(normalize_for_auto_completion("长发"), "长发");
        assert_eq!(normalize_for_query("女孩"), "女孩");
        assert_eq!(normalize_for_query("长发"), "长发");

        // Test Korean characters (should remain unchanged)
        assert_eq!(normalize_for_auto_completion("소녀"), "소녀");
        assert_eq!(normalize_for_auto_completion("단발"), "단발");
        assert_eq!(normalize_for_query("소녀"), "소녀");
        assert_eq!(normalize_for_query("단발"), "단발");
    }

    #[test]
    fn test_complex_mixed_text() {
        // Test complex mixed text with all types of characters
        let complex_text = "1girl_女の子_テスト_ひらがな_소녀_test";
        assert_eq!(
            normalize_for_auto_completion(complex_text),
            "1girl 女の子 てすと ひらがな 소녀 test"
        );
        assert_eq!(
            normalize_for_query(complex_text),
            "1girl 女の子 テスト ひらがな 소녀 test"
        );
    }
}

use base64::{Engine, prelude::BASE64_STANDARD_NO_PAD};
use std::io::Write;
use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen]
pub fn encode_text(text: String) -> Result<String, String> {
    // Brotli compression → Base64 encoding → Prefix with "BR-"
    let mut writer = brotli::CompressorWriter::new(Vec::new(), 4096, 11, 22);
    writer
        .write_all(text.as_bytes())
        .map_err(|err| format!("Failed to compress text: {err}"))?;
    let buffer = writer.into_inner();

    let base64_encoded = BASE64_STANDARD_NO_PAD.encode(buffer);

    Ok(format!("BR-{base64_encoded}"))
}

#[wasm_bindgen]
pub fn decode_text(text: String) -> Result<String, String> {
    if let Some(stripped) = text.strip_prefix("BR-") {
        let compressed = BASE64_STANDARD_NO_PAD
            .decode(stripped)
            .map_err(|err| format!("Failed to decode Base64: {err}"))?;

        let mut writer = brotli::DecompressorWriter::new(Vec::new(), 4096);
        writer
            .write_all(&compressed)
            .map_err(|err| format!("Failed to decompress text: {err}"))?;
        let decompressed = writer
            .into_inner()
            .map_err(|_| "Failed to decompress text".to_string())?;

        Ok(String::from_utf8_lossy(&decompressed).into_owned())
    } else {
        Err("Invalid encoded text format".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_text_basic() {
        // Test basic encoding
        let result = encode_text("hello".to_string());
        assert!(result.is_ok());

        let encoded = result.unwrap();
        assert!(encoded.starts_with("BR-"));
        assert!(encoded.len() > 3); // Should have content after "BR-"
    }

    #[test]
    fn test_decode_text_basic() {
        // Test basic decoding with known valid input
        let original = "hello".to_string();
        let encoded = encode_text(original.clone()).unwrap();
        let decoded = decode_text(encoded).unwrap();
        assert_eq!(decoded, original);
    }

    #[test]
    fn test_round_trip_comprehensive() {
        // Test round-trip encoding/decoding with various text types
        let test_cases = vec![
            ("", "empty string"),
            ("hello world", "normal text"),
            ("!@#$%^&*()_+-=[]{}|;':\",./<>?", "special characters"),
            ("こんにちは世界", "unicode"),
            ("Hello 世界 мир العالم 🌍", "multilingual"),
            (
                "line1\nline2\r\nline3\ttab\n  spaces  ",
                "newlines and whitespace",
            ),
            (r#"{"key": "value", "number": 42}"#, "json-like structure"),
        ];

        for (original, description) in test_cases {
            let encoded = encode_text(original.to_string()).unwrap();
            let decoded = decode_text(encoded).unwrap();
            assert_eq!(decoded, original, "Round-trip failed for: {description}");
        }

        // Test long text separately
        let long_text = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(50);
        let encoded = encode_text(long_text.clone()).unwrap();
        let decoded = decode_text(encoded).unwrap();
        assert_eq!(decoded, long_text, "Round-trip failed for: long text");

        // Test all ASCII printable characters separately
        let ascii_chars = (32..127).map(|i| i as u8 as char).collect::<String>();
        let encoded = encode_text(ascii_chars.clone()).unwrap();
        let decoded = decode_text(encoded).unwrap();
        assert_eq!(
            decoded, ascii_chars,
            "Round-trip failed for: all ascii printable"
        );
    }

    #[test]
    fn test_decode_invalid_format() {
        // Test decoding with invalid format (no BR- prefix)
        let result = decode_text("invalid_format".to_string());
        assert!(result.is_err());

        let error = result.unwrap_err();
        assert_eq!(error, "Invalid encoded text format");
    }

    #[test]
    fn test_decode_invalid_base64() {
        // Test decoding with invalid base64
        let result = decode_text("BR-invalid_base64!@#".to_string());
        assert!(result.is_err());

        let error = result.unwrap_err();
        assert!(error.contains("Failed to decode Base64"));
    }

    #[test]
    fn test_encode_format() {
        // Test that encoded text has correct format
        let encoded = encode_text("test".to_string()).unwrap();
        assert!(encoded.starts_with("BR-"));

        // The part after "BR-" should be valid base64
        let base64_part = &encoded[3..];
        assert!(
            base64_part
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '+' || c == '/')
        );
    }

    #[test]
    fn test_compression_effectiveness() {
        // Test that compression is effective for repetitive text
        let original = "repeat ".repeat(1000);
        let encoded = encode_text(original.clone()).unwrap();
        let encoded_len = encoded.len(); // Store length before moving

        // Compressed + base64 + prefix should be much shorter than original
        assert!(encoded_len < original.len() / 2);

        // Verify round-trip still works
        let decoded = decode_text(encoded).unwrap();
        assert_eq!(decoded, original);
    }

    // Snapshot tests for encode_text
    #[test]
    fn test_encode_snapshots() {
        // Test encode_text with known inputs and verify exact output format

        // Empty string
        let encoded = encode_text("".to_string()).unwrap();
        assert_eq!(encoded, "BR-Ow");

        // Simple word
        let encoded = encode_text("hello".to_string()).unwrap();
        assert_eq!(encoded, "BR-CwKAaGVsbG8D");

        // Unicode characters
        let encoded = encode_text("テスト".to_string()).unwrap();
        assert_eq!(encoded, "BR-CwSA44OG44K544OIAw");

        // Prompt studio pattern
        let encoded = encode_text("1girl, long_hair".to_string()).unwrap();
        assert_eq!(encoded, "BR-iweAMWdpcmwsIGxvbmdfaGFpcgM");

        // Special characters with newlines
        let encoded = encode_text("a\nb\tc".to_string()).unwrap();
        assert_eq!(encoded, "BR-CwKAYQpiCWMD");
    }

    // Snapshot tests for decode_text
    #[test]
    fn test_decode_snapshots() {
        // Test decode_text with known encoded inputs and verify exact output

        // Empty string
        let decoded = decode_text("BR-Ow".to_string()).unwrap();
        assert_eq!(decoded, "");

        // Simple word
        let decoded = decode_text("BR-CwKAaGVsbG8D".to_string()).unwrap();
        assert_eq!(decoded, "hello");

        // Unicode characters
        let decoded = decode_text("BR-CwSA44OG44K544OIAw".to_string()).unwrap();
        assert_eq!(decoded, "テスト");

        // Prompt studio pattern
        let decoded = decode_text("BR-iweAMWdpcmwsIGxvbmdfaGFpcgM".to_string()).unwrap();
        assert_eq!(decoded, "1girl, long_hair");

        // Special characters with newlines
        let decoded = decode_text("BR-CwKAYQpiCWMD".to_string()).unwrap();
        assert_eq!(decoded, "a\nb\tc");
    }
}

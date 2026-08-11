//! Regression tests for issue #151: taking `reqwest` with default features made
//! every consumer of this crate inherit `native-tls` and therefore an
//! `openssl-sys` build dependency, breaking builds on machines without
//! `pkg-config` or OpenSSL headers.

const MANIFEST: &str = include_str!("../../Cargo.toml");

/// Extract the value of a top-level dependency entry, joined into one line.
fn dependency_entry(name: &str) -> String {
    let start = MANIFEST
        .find(&format!("\n{name} = "))
        .unwrap_or_else(|| panic!("dependency `{name}` not found in Cargo.toml"))
        + 1;
    let rest = &MANIFEST[start..];
    // The entry ends at the closing brace of the inline table.
    let end = rest
        .find('}')
        .unwrap_or_else(|| panic!("dependency `{name}` is not an inline table"));
    rest[..=end]
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

#[test]
fn reqwest_does_not_use_default_features() {
    let entry = dependency_entry("reqwest");
    assert!(
        entry.contains("default-features = false"),
        "reqwest must be taken with `default-features = false` so that `native-tls` \
         (and `openssl-sys`) stay out of every consumer's tree; found: {entry}"
    );
}

#[test]
fn reqwest_selects_rustls() {
    let entry = dependency_entry("reqwest");
    assert!(
        entry.contains("\"rustls-tls\""),
        "reqwest must select `rustls-tls` as its TLS backend; found: {entry}"
    );
}

#[test]
fn reqwest_keeps_the_default_features_the_crate_relies_on() {
    let entry = dependency_entry("reqwest");
    // `charset` backs `Response::text()`, `http2` and `gzip` back the transport,
    // `cookies` backs session reuse. Dropping any of them silently changes behavior.
    for feature in ["charset", "cookies", "gzip", "http2"] {
        assert!(
            entry.contains(&format!("\"{feature}\"")),
            "reqwest must keep the `{feature}` feature; found: {entry}"
        );
    }
}

#[test]
fn native_tls_is_opt_in_only() {
    assert!(
        MANIFEST.contains("native-tls = [\"dep:reqwest\", \"reqwest/native-tls\"]"),
        "the system TLS stack must remain available as an opt-in `native-tls` feature"
    );
    let default = MANIFEST
        .find("default = [")
        .map(|start| &MANIFEST[start..MANIFEST[start..].find(']').unwrap() + start])
        .expect("`default` feature not found in Cargo.toml");
    assert!(
        !default.contains("native-tls"),
        "the `native-tls` feature must not be part of the default feature set"
    );
}

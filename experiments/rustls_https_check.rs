//! Issue #151: proves the rustls-backed reqwest client still performs a real
//! HTTPS request (no native-tls / OpenSSL involved).
//!
//! Run with: cargo run --manifest-path experiments/rustls-https-check/Cargo.toml
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = reqwest::Client::builder().cookie_store(true).gzip(true).build()?;
    let response = client.get("https://example.com").send().await?;
    println!("status: {}", response.status());
    let body = response.text().await?;
    println!("body bytes: {}", body.len());
    assert!(body.contains("Example Domain"));
    println!("HTTPS over rustls: OK");
    Ok(())
}

use web_capture::BrowserEngine;

#[test]
fn test_browser_engine_display() {
    assert_eq!(BrowserEngine::Chromiumoxide.to_string(), "chromiumoxide");
}

#[test]
fn test_browser_engine_from_str() {
    assert_eq!(
        "chromiumoxide".parse::<BrowserEngine>().unwrap(),
        BrowserEngine::Chromiumoxide
    );
    assert_eq!(
        "chrome".parse::<BrowserEngine>().unwrap(),
        BrowserEngine::Chromiumoxide
    );
    assert!("invalid".parse::<BrowserEngine>().is_err());
}

#[test]
fn test_browser_engine_default() {
    assert_eq!(BrowserEngine::default(), BrowserEngine::Chromiumoxide);
}

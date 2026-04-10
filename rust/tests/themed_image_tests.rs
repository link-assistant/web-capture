use web_capture::themed_image::{Theme, ThemedImageOptions};

#[test]
fn test_theme_display() {
    assert_eq!(Theme::Light.to_string(), "light");
    assert_eq!(Theme::Dark.to_string(), "dark");
}

#[test]
fn test_theme_from_str() {
    assert_eq!("light".parse::<Theme>().unwrap(), Theme::Light);
    assert_eq!("dark".parse::<Theme>().unwrap(), Theme::Dark);
    assert!("invalid".parse::<Theme>().is_err());
}

#[test]
fn test_themed_image_options_default() {
    let opts = ThemedImageOptions::default();
    assert_eq!(opts.width, 1920);
    assert_eq!(opts.height, 1080);
    assert!(opts.full_page);
    assert!(opts.dismiss_popups);
}

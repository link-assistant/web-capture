use web_capture::localize_images::{
    extract_image_references, generate_local_filename, get_extension_from_url, localize_images,
    LocalizeOptions,
};

#[test]
fn test_extract_image_references() {
    let md =
        "![Alt text](https://example.com/image.png) and ![Other](https://example.com/photo.jpg)";
    let images = extract_image_references(md);
    assert_eq!(images.len(), 2);
    assert_eq!(images[0].alt_text, "Alt text");
    assert_eq!(images[0].url, "https://example.com/image.png");
    assert_eq!(images[1].alt_text, "Other");
}

#[test]
fn test_extract_image_references_no_match() {
    let md = "Just [a link](https://example.com) and no images";
    let images = extract_image_references(md);
    assert!(images.is_empty());
}

#[test]
fn test_get_extension_from_url_png() {
    assert_eq!(
        get_extension_from_url("https://example.com/image.png"),
        ".png"
    );
}

#[test]
fn test_get_extension_from_url_jpg() {
    assert_eq!(
        get_extension_from_url("https://example.com/photo.jpg"),
        ".jpg"
    );
}

#[test]
fn test_get_extension_from_url_with_query() {
    assert_eq!(
        get_extension_from_url("https://example.com/photo.webp?v=2"),
        ".webp"
    );
}

#[test]
fn test_get_extension_from_url_no_extension() {
    assert_eq!(get_extension_from_url("https://example.com/image"), ".png");
}

#[test]
fn test_generate_local_filename() {
    assert_eq!(
        generate_local_filename("https://example.com/photo.jpg", 0),
        "image-01.jpg"
    );
    assert_eq!(
        generate_local_filename("https://example.com/photo.jpg", 9),
        "image-10.jpg"
    );
}

#[tokio::test]
async fn test_localize_images_dry_run() {
    let md = "![test](https://example.com/img.png)";
    let opts = LocalizeOptions {
        dry_run: true,
        ..Default::default()
    };
    let result = localize_images(md, &opts).await;
    assert_eq!(result.total, 1);
    assert!(result.markdown.contains("images/image-01.png"));
}

#[tokio::test]
async fn test_localize_images_exclude_domain() {
    let md = "![test](https://excluded.com/img.png)";
    let opts = LocalizeOptions {
        dry_run: true,
        exclude_domains: vec!["excluded.com".to_string()],
        ..Default::default()
    };
    let result = localize_images(md, &opts).await;
    assert_eq!(result.total, 0);
    assert!(result.markdown.contains("https://excluded.com"));
}

#[tokio::test]
async fn test_localize_images_already_local() {
    let md = "![test](images/image-01.png)";
    let opts = LocalizeOptions {
        dry_run: true,
        ..Default::default()
    };
    let result = localize_images(md, &opts).await;
    assert_eq!(result.total, 0);
}

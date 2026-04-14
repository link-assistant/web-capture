use web_capture::animation::{AnimationOptions, CaptureMode};

#[test]
fn test_compare_frames_identical() {
    let frame = vec![1, 2, 3, 4, 5];
    assert!((web_capture::animation::compare_frames(&frame, &frame) - 1.0).abs() < f64::EPSILON);
}

#[test]
fn test_compare_frames_completely_different() {
    let frame1 = vec![0, 0, 0, 0];
    let frame2 = vec![255, 255, 255, 255];
    assert!((web_capture::animation::compare_frames(&frame1, &frame2)).abs() < f64::EPSILON);
}

#[test]
fn test_compare_frames_partial() {
    let frame1 = vec![1, 2, 3, 4];
    let frame2 = vec![1, 2, 0, 0];
    assert!((web_capture::animation::compare_frames(&frame1, &frame2) - 0.5).abs() < f64::EPSILON);
}

#[test]
fn test_compare_frames_empty() {
    assert!((web_capture::animation::compare_frames(&[], &[])).abs() < f64::EPSILON);
}

#[test]
fn test_compare_frames_different_length() {
    let frame1 = vec![1, 2, 3];
    let frame2 = vec![1, 2];
    assert!((web_capture::animation::compare_frames(&frame1, &frame2)).abs() < f64::EPSILON);
}

#[test]
fn test_capture_mode_display() {
    assert_eq!(CaptureMode::Screenshot.to_string(), "screenshot");
    assert_eq!(CaptureMode::Screencast.to_string(), "screencast");
    assert_eq!(CaptureMode::Beginframe.to_string(), "beginframe");
}

#[test]
fn test_capture_mode_from_str() {
    assert_eq!(
        "screenshot".parse::<CaptureMode>().unwrap(),
        CaptureMode::Screenshot
    );
    assert_eq!(
        "screencast".parse::<CaptureMode>().unwrap(),
        CaptureMode::Screencast
    );
    assert!("invalid".parse::<CaptureMode>().is_err());
}

#[test]
fn test_animation_options_default() {
    let opts = AnimationOptions::default();
    assert_eq!(opts.max_size, 1024);
    assert_eq!(opts.min_frames, 120);
    assert!((opts.similarity - 0.99).abs() < f64::EPSILON);
    assert_eq!(opts.capture_mode, CaptureMode::Screenshot);
}

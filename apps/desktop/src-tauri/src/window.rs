use tauri::{WebviewUrl, WebviewWindow};

pub fn build_main_window<'a>(
    app: &'a tauri::AppHandle,
    label: &'a str,
    url: impl Into<std::path::PathBuf>,
) -> tauri::webview::WebviewWindowBuilder<'a, tauri::Wry, tauri::AppHandle<tauri::Wry>> {
    let mut builder = WebviewWindow::builder(app, label, WebviewUrl::App(url.into()))
        .title("Dicto")
        .inner_size(1200.0, 800.0)
        .min_inner_size(1100.0, 600.0)
        .maximizable(false)
        .resizable(false);

    #[cfg(target_os = "macos")]
    {
        builder = builder
            .decorations(true)
            .hidden_title(true)
            .theme(Some(tauri::Theme::Light))
            .traffic_light_position(tauri::LogicalPosition::new(16.0, 18.0))
            .title_bar_style(tauri::TitleBarStyle::Overlay);
    }

    builder
}

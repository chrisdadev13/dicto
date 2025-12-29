mod commands;
mod db;
mod events;
mod formatter;
mod model_download;
mod shortcut;
mod transcription;
mod tray;
mod window;

use specta_typescript::Typescript;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{Emitter, Manager, WebviewUrl};
use tauri::menu::{MenuBuilder, SubmenuBuilder};
use tauri_nspanel::{
    tauri_panel, CollectionBehavior, ManagerExt, PanelBuilder, PanelLevel, StyleMask,
    WebviewPanelManager,
};
use tauri_specta::{collect_commands, Builder};
use transcription::{create_transcription_service, TranscriptionServiceHandle};

tauri_panel! {
    panel!(WidgetPanel {
        config: {
            can_become_key_window: true,
            is_floating_panel: true
        }
    })
}

#[derive(serde::Serialize, specta::Type)]
struct AppInfo {
    app_name: String,
    url: Option<String>,
}

#[tauri::command]
#[specta::specta]
async fn get_frontmost_app() -> Result<AppInfo, String> {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;

        // Get frontmost app name
        let app_output = Command::new("osascript")
            .arg("-e")
            .arg("tell application \"System Events\" to get name of first application process whose frontmost is true")
            .output()
            .map_err(|e| e.to_string())?;

        let app_name = String::from_utf8_lossy(&app_output.stdout)
            .trim()
            .to_string();

        // Check if it's a supported browser and get URL
        let url = match app_name.as_str() {
            "Google Chrome" | "Arc" => {
                let script = format!(
                    "tell application \"{}\" to get URL of active tab of front window",
                    app_name
                );
                Command::new("osascript")
                    .arg("-e")
                    .arg(&script)
                    .output()
                    .ok()
                    .and_then(|o| {
                        let url = String::from_utf8_lossy(&o.stdout).trim().to_string();
                        if url.is_empty() {
                            None
                        } else {
                            Some(url)
                        }
                    })
            }
            "Safari" => Command::new("osascript")
                .arg("-e")
                .arg("tell application \"Safari\" to get URL of current tab of front window")
                .output()
                .ok()
                .and_then(|o| {
                    let url = String::from_utf8_lossy(&o.stdout).trim().to_string();
                    if url.is_empty() {
                        None
                    } else {
                        Some(url)
                    }
                }),
            _ => None,
        };

        Ok(AppInfo { app_name, url })
    }

    #[cfg(not(target_os = "macos"))]
    Err("Platform detection only available on macOS".to_string())
}

/// Saves a transcription to the local SQLite database.
/// Returns the generated UUID on success.
fn save_transcription(
    app: &tauri::AppHandle,
    text: &str,
    formatted_text: Option<&str>,
) -> Result<String, String> {
    use tauri::Manager;

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    let db_path = app_data_dir.join("dicto.db");

    println!("Opening database at: {:?}", db_path);

    let conn = rusqlite::Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {:?}: {}", db_path, e))?;

    let id = uuid::Uuid::new_v4().to_string();
    let created_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("Failed to get timestamp: {}", e))?
        .as_secs() as i64;

    conn.execute(
        "INSERT INTO transcriptions (id, text, formatted_text, created_at) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![id, text, formatted_text, created_at],
    )
    .map_err(|e| format!("Failed to insert transcription: {}", e))?;

    println!("✅ Saved transcription with id: {}", id);

    Ok(id)
}

#[tauri::command]
#[specta::specta]
async fn start_recording(
    app: tauri::AppHandle,
    service: tauri::State<'_, TranscriptionServiceHandle>,
    settings: crate::transcription::TranscriptionSettings,
) -> Result<(), String> {
    let mut service = service.lock().await;
    service
        .start_recording(app, settings)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
async fn stop_recording(
    app: tauri::AppHandle,
    service: tauri::State<'_, TranscriptionServiceHandle>,
    app_name: String,
    style: String,
) -> Result<(), String> {
    let mut service = service.lock().await;
    println!("{:?}", style);
    service
        .stop_recording(app, app_name, style)
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
async fn is_recording(
    service: tauri::State<'_, TranscriptionServiceHandle>,
) -> Result<bool, String> {
    let service = service.lock().await;
    Ok(service.is_recording())
}

#[tauri::command]
#[specta::specta]
async fn paste_text(app: tauri::AppHandle, text: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use cocoa::base::{id, nil};
        use cocoa::foundation::NSString;
        use core_graphics::event::{CGEvent, CGEventFlags, CGEventTapLocation};
        use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};
        use objc::{class, msg_send, sel, sel_impl};
        use std::thread;
        // use std::time::Duration;

        // Clone app handle and text for the thread
        let app_clone = app.clone();
        let text_clone = text.clone();

        thread::spawn(move || {
            unsafe {
                let pasteboard: id = msg_send![class!(NSPasteboard), generalPasteboard];
                if pasteboard == nil {
                    eprintln!("Failed to get pasteboard");
                    if let Some(widget_window) = app_clone
                        .get_webview_panel("widget")
                        .ok()
                        .and_then(|p| p.to_window())
                    {
                        let _ = widget_window.emit("paste-complete", ());
                    }
                    return;
                }

                // Clear contents
                let _: () = msg_send![pasteboard, clearContents];

                // Create NSString for the text
                let ns_string = NSString::alloc(nil).init_str(&text_clone);
                if ns_string == nil {
                    eprintln!("Failed to create NSString");
                    if let Some(widget_window) = app_clone
                        .get_webview_panel("widget")
                        .ok()
                        .and_then(|p| p.to_window())
                    {
                        let _ = widget_window.emit("paste-complete", ());
                    }
                    return;
                }

                let ns_string_type = NSString::alloc(nil).init_str("public.utf8-plain-text");
                let success: bool =
                    msg_send![pasteboard, setString:ns_string forType:ns_string_type];

                if !success {
                    eprintln!("Failed to set string to pasteboard");
                    if let Some(widget_window) = app_clone
                        .get_webview_panel("widget")
                        .ok()
                        .and_then(|p| p.to_window())
                    {
                        let _ = widget_window.emit("paste-complete", ());
                    }
                    return;
                }

                // Small delay before sending keyboard events
                // thread::sleep(Duration::from_millis(50));

                // Send Cmd+V keyboard events
                if let Ok(event_source) = CGEventSource::new(CGEventSourceStateID::HIDSystemState) {
                    if let Ok(key_down) = CGEvent::new_keyboard_event(event_source.clone(), 9, true)
                    {
                        key_down.set_flags(CGEventFlags::CGEventFlagCommand);
                        let _ = key_down.post(CGEventTapLocation::HID);
                    }

                    // thread::sleep(Duration::from_millis(50));

                    if let Ok(key_up) = CGEvent::new_keyboard_event(event_source, 9, false) {
                        key_up.set_flags(CGEventFlags::CGEventFlagCommand);
                        let _ = key_up.post(CGEventTapLocation::HID);
                    }
                }

                // // Wait a bit for paste to complete
                // thread::sleep(Duration::from_millis(100));

                // Clear clipboard after pasting (don't restore old contents to avoid exceptions)
                let _: () = msg_send![pasteboard, clearContents];

                println!("✅ Pasted successfully.");
            }

            // Always emit paste-complete event
            if let Some(widget_window) = app_clone
                .get_webview_panel("widget")
                .ok()
                .and_then(|p| p.to_window())
            {
                let _ = widget_window.emit("paste-complete", ());
            }
        });
    }

    #[cfg(not(target_os = "macos"))]
    {
        return Err("Paste functionality is only available on macOS".to_string());
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = Builder::<tauri::Wry>::new().commands(collect_commands![
        // Core app commands
        start_recording,
        stop_recording,
        is_recording,
        paste_text,
        get_frontmost_app,
        // Model download - STT
        model_download::check_stt_model_status,
        model_download::download_stt_model,
        // Model download - LLM
        model_download::check_llm_model_status,
        model_download::download_llm_model,
        // Shortcut
        shortcut::get_current_shortcut,
        shortcut::change_shortcut,
        shortcut::unregister_shortcut,
        // Keyterms
        commands::keyterms::keyterms_list,
        commands::keyterms::keyterms_get,
        commands::keyterms::keyterms_create,
        commands::keyterms::keyterms_update,
        commands::keyterms::keyterms_delete,
        // Settings
        commands::settings::settings_list,
        commands::settings::settings_get,
        commands::settings::settings_set,
        commands::settings::settings_delete,
        // Keys Vault
        commands::keys_vault::keys_vault_list,
        commands::keys_vault::keys_vault_get,
        commands::keys_vault::keys_vault_set,
        commands::keys_vault::keys_vault_delete,
        // Transcriptions
        commands::transcriptions::transcriptions_list,
        commands::transcriptions::transcriptions_get,
        commands::transcriptions::transcriptions_create,
        commands::transcriptions::transcriptions_update,
        commands::transcriptions::transcriptions_delete,
        commands::transcriptions::transcriptions_analytics,
        // Notes
        commands::notes::notes_list,
        commands::notes::notes_get,
        commands::notes::notes_create,
        commands::notes::notes_update,
        commands::notes::notes_delete,
        // Shortcuts
        commands::shortcuts::shortcuts_list,
        commands::shortcuts::shortcuts_get,
        commands::shortcuts::shortcuts_create,
        commands::shortcuts::shortcuts_update,
        commands::shortcuts::shortcuts_delete,
        // Writing Styles
        commands::writing_styles::writing_styles_list,
        commands::writing_styles::writing_styles_get,
        commands::writing_styles::writing_styles_update
    ]);

    #[cfg(debug_assertions)]
    builder
        .export(
            Typescript::default().bigint(specta_typescript::BigIntExportBehavior::Number),
            "../src/bindings.ts",
        )
        .expect("Failed to export typescript bindings");

    let transcription_service = create_transcription_service();

    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .manage(WebviewPanelManager::<tauri::Wry>::default())
        .plugin(tauri_nspanel::init::<tauri::Wry>())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_macos_permissions::init())
        .plugin(db::init_database())
        .manage(transcription_service)
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            builder.mount_events(app.handle());

            // Initialize database connection pool after migrations
            db::setup_pool(app)?;

            // Create menubar
            let app_menu = SubmenuBuilder::new(app, "Dicto")
                .about(None)
                .separator()
                .hide()
                .hide_others()
                .show_all()
                .separator()
                .quit()
                .build()?;

            let file_menu = SubmenuBuilder::new(app, "File")
                .text("new", "New Recording")
                .separator()
                .text("settings", "Settings")
                .build()?;

            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .separator()
                .select_all()
                .build()?;

            let view_menu = SubmenuBuilder::new(app, "View")
                .text("transcriptions", "Transcriptions")
                .text("notes", "Notes")
                .text("keyterms", "Dictionary")
                .text("writing-styles", "Writing Styles")
                .separator()
                .text("reload", "Reload")
                .build()?;

            let help_menu = SubmenuBuilder::new(app, "Help")
                .text("docs", "Documentation")
                .separator()
                .text("report", "Report Issue")
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&app_menu)
                .item(&file_menu)
                .item(&edit_menu)
                .item(&view_menu)
                .item(&help_menu)
                .build()?;

            app.set_menu(menu)?;

            // Handle menu events
            app.on_menu_event(move |app_handle, event| {
                match event.id().as_ref() {
                    "new" => {
                        println!("New Recording clicked");
                    }
                    "settings" => {
                        println!("Settings clicked");
                        let _ = app_handle.emit("open-settings", ());
                    }
                    "transcriptions" => {
                        println!("Transcriptions clicked");
                        let _ = app_handle.emit("navigate-transcriptions", ());
                    }
                    "notes" => {
                        println!("Notes clicked");
                        let _ = app_handle.emit("navigate-notes", ());
                    }
                    "keyterms" => {
                        println!("Keyterms clicked");
                        let _ = app_handle.emit("navigate-keyterms", ());
                    }
                    "writing-styles" => {
                        println!("Writing Styles clicked");
                        let _ = app_handle.emit("navigate-writing-styles", ());
                    }
                    "reload" => {
                        println!("Reload clicked");
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.eval("location.reload()");
                        }
                    }
                    "docs" => {
                        println!("Documentation clicked");
                        let _ = app_handle.emit("open-docs", ());
                    }
                    "report" => {
                        println!("Report Issue clicked");
                        let _ = app_handle.emit("open-report-issue", ());
                    }
                    _ => {}
                }
            });

            let main_window = window::build_main_window(app.handle(), "main", "index.html")
                .build()
                .map_err(|e| e.to_string())?;

            // Make the window hide instead of close when X is clicked
            let window_clone = main_window.clone();
            main_window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    window_clone.hide().unwrap();
                    api.prevent_close();
                }
            });

                let panel = PanelBuilder::<tauri::Wry, WidgetPanel>::new(app.handle(), "widget")
                .url(WebviewUrl::App("widget.html".into()))
                .size(tauri::Size::Logical(tauri::LogicalSize {
                    width: 80.0, // When chat 535
                    height: 32.0, // When chat 370
                }))
                .level(PanelLevel::Floating)
                .has_shadow(false)
                .collection_behavior(
                    CollectionBehavior::new()
                        .can_join_all_spaces()
                        .full_screen_auxiliary()
                        .into(),
                )
                .hides_on_deactivate(false)
                .works_when_modal(true)
                .with_window(|w| w.decorations(false).transparent(true))
                .style_mask(StyleMask::empty().nonactivating_panel().into())
                .build()
                .map_err(|e| e.to_string())?;

            panel.show();

            // Initialize global shortcut from stored settings
            shortcut::enable_shortcut(app);

            // Position widget window at top center
            if let Some(widget_window) = panel.to_window() {
                // Set window to be visible on all workspaces/desktops (macOS)
                #[cfg(target_os = "macos")]
                {
                    use cocoa::appkit::{NSWindow, NSWindowCollectionBehavior, NSColor};
                    use cocoa::base::{id, nil};
                    
                    unsafe {
                        if let Ok(ns_window_ptr) = widget_window.ns_window() {
                            let ns_window = ns_window_ptr as id;

                            // Combine both behaviors for all spaces + fullscreen visibility
                            let behavior = NSWindowCollectionBehavior::NSWindowCollectionBehaviorCanJoinAllSpaces
                                | NSWindowCollectionBehavior::NSWindowCollectionBehaviorFullScreenAuxiliary;
                            
                            ns_window.setCollectionBehavior_(behavior);
                            
                            // Set window level to ensure it stays on top
                            ns_window.setLevel_(cocoa::appkit::NSMainMenuWindowLevel as i64 + 1);
                            
                            // Make window background fully transparent
                            ns_window.setOpaque_(false);
                            ns_window.setBackgroundColor_(NSColor::clearColor(nil));
                            ns_window.setHasShadow_(false); 

                            // Disable window dragging by background
                            ns_window.setMovableByWindowBackground_(cocoa::base::NO);

                            ns_window.setAlphaValue_(0.9); 
                        }
                    }
                }
                
                // Position the window
                if let Ok(primary_monitor) = widget_window.primary_monitor() {
                    if let Some(monitor) = primary_monitor {
                        let size = monitor.size();
                        let scale_factor = monitor.scale_factor();
                        
                        let widget_width = 50.0;
                        let widget_height = 20.0; // Add your widget's height

                        let x = (size.width as f64 / scale_factor - widget_width) / 2.0;
                        let y = (size.height as f64 / scale_factor - widget_height) - 15.0; // 50.0 is bottom margin

                        
                        let _ = widget_window.set_position(tauri::LogicalPosition::new(x, y));
                    }
                }
            }

            // Initialize system tray
            tray::create_tray(app.handle())?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

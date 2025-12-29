use tauri::{
    menu::{CheckMenuItemBuilder, Menu, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Listener, Manager, Runtime,
};

fn get_current_languages<R: Runtime>(app: &AppHandle<R>) -> (Vec<String>, bool) {
    use rusqlite::Connection;
    use std::path::PathBuf;

    let app_data_dir = app.path().app_data_dir().ok();
    if let Some(dir) = app_data_dir {
        let db_path: PathBuf = dir.join("dicto.db");
        if let Ok(conn) = Connection::open(&db_path) {
            // Get languages setting
            let languages = conn
                .query_row(
                    "SELECT value FROM settings WHERE key = 'languages'",
                    [],
                    |row| row.get::<_, String>(0),
                )
                .ok()
                .and_then(|v| serde_json::from_str::<Vec<String>>(&v).ok())
                .unwrap_or_else(|| vec!["en-US".to_string()]);

            // Get auto-detect setting
            let auto_detect = conn
                .query_row(
                    "SELECT value FROM settings WHERE key = 'autoDetectLanguage'",
                    [],
                    |row| row.get::<_, String>(0),
                )
                .ok()
                .map(|v| v == "true")
                .unwrap_or(false);

            return (languages, auto_detect);
        }
    }

    (vec!["en-US".to_string()], false)
}

fn build_tray_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let (current_languages, auto_detect) = get_current_languages(app);

    // Create menu items
    let open_dashboard = MenuItemBuilder::with_id("open_dashboard", "Open Dashboard").build(app)?;
    let separator1 = PredefinedMenuItem::separator(app)?;

    // Quick Actions submenu
    let add_to_dictionary = MenuItemBuilder::with_id("add_dictionary", "Add to Dictionary").build(app)?;
    let quick_actions = SubmenuBuilder::new(app, "Quick Actions")
        .item(&add_to_dictionary)
        .build()?;

    // Languages submenu - with flags and checkboxes
    let lang_en = CheckMenuItemBuilder::with_id("lang_en-US", "🇺🇸 English (US)")
        .checked(current_languages.contains(&"en-US".to_string()))
        .build(app)?;
    let lang_en_gb = CheckMenuItemBuilder::with_id("lang_en-GB", "🇬🇧 English (UK)")
        .checked(current_languages.contains(&"en-GB".to_string()))
        .build(app)?;
    let lang_es = CheckMenuItemBuilder::with_id("lang_es", "🇪🇸 Spanish")
        .checked(current_languages.contains(&"es".to_string()))
        .build(app)?;
    let lang_fr = CheckMenuItemBuilder::with_id("lang_fr", "🇫🇷 French")
        .checked(current_languages.contains(&"fr".to_string()))
        .build(app)?;
    let lang_de = CheckMenuItemBuilder::with_id("lang_de", "🇩🇪 German")
        .checked(current_languages.contains(&"de".to_string()))
        .build(app)?;
    let lang_it = CheckMenuItemBuilder::with_id("lang_it", "🇮🇹 Italian")
        .checked(current_languages.contains(&"it".to_string()))
        .build(app)?;
    let lang_pt = CheckMenuItemBuilder::with_id("lang_pt", "🇵🇹 Portuguese")
        .checked(current_languages.contains(&"pt".to_string()))
        .build(app)?;
    let lang_ja = CheckMenuItemBuilder::with_id("lang_ja", "🇯🇵 Japanese")
        .checked(current_languages.contains(&"ja".to_string()))
        .build(app)?;
    let lang_ko = CheckMenuItemBuilder::with_id("lang_ko", "🇰🇷 Korean")
        .checked(current_languages.contains(&"ko".to_string()))
        .build(app)?;
    let lang_zh = CheckMenuItemBuilder::with_id("lang_zh", "🇨🇳 Chinese")
        .checked(current_languages.contains(&"zh".to_string()))
        .build(app)?;
    let separator_lang = PredefinedMenuItem::separator(app)?;
    let lang_auto = CheckMenuItemBuilder::with_id("lang_auto", "Auto-detect Language")
        .checked(auto_detect)
        .build(app)?;

    let languages = SubmenuBuilder::new(app, "Languages")
        .item(&lang_en)
        .item(&lang_en_gb)
        .item(&lang_es)
        .item(&lang_fr)
        .item(&lang_de)
        .item(&lang_it)
        .item(&lang_pt)
        .item(&lang_ja)
        .item(&lang_ko)
        .item(&lang_zh)
        .item(&separator_lang)
        .item(&lang_auto)
        .build()?;

    let separator2 = PredefinedMenuItem::separator(app)?;
    let settings = MenuItemBuilder::with_id("settings", "Settings").build(app)?;
    let separator3 = PredefinedMenuItem::separator(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

    // Build the menu
    let menu = Menu::with_items(
        app,
        &[
            &open_dashboard,
            &separator1,
            &quick_actions,
            &languages,
            &separator2,
            &settings,
            &separator3,
            &quit,
        ],
    )?;

    Ok(menu)
}

pub fn create_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let menu = build_tray_menu(app)?;

    // Create the tray icon
    let _tray = TrayIconBuilder::with_id("main")
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| {
            match event.id.as_ref() {
                "open_dashboard" => {
                    println!("Open Dashboard clicked");
                    if let Some(window) = app.get_webview_window("main") {
                        println!("Main window found, attempting to show");
                        if let Err(e) = window.unminimize() {
                            println!("Failed to unminimize: {}", e);
                        }
                        if let Err(e) = window.show() {
                            println!("Failed to show: {}", e);
                        }
                        if let Err(e) = window.set_focus() {
                            println!("Failed to set focus: {}", e);
                        }
                        #[cfg(target_os = "macos")]
                        {
                            // On macOS, we need to explicitly raise the window
                            use cocoa::appkit::NSApplication;
                            use objc::{msg_send, sel, sel_impl};
                            unsafe {
                                let ns_app = cocoa::appkit::NSApp();
                                let _: () = msg_send![ns_app, activateIgnoringOtherApps: cocoa::base::YES];
                            }
                        }
                    } else {
                        println!("Main window not found!");
                    }
                }
                "add_dictionary" => {
                    println!("Add to Dictionary clicked");
                    let _ = app.emit("open-add-keyterm", ());
                }
                "lang_en-US" => {
                    let _ = app.emit("toggle-language", "en-US");
                }
                "lang_en-GB" => {
                    let _ = app.emit("toggle-language", "en-GB");
                }
                "lang_es" => {
                    let _ = app.emit("toggle-language", "es");
                }
                "lang_fr" => {
                    let _ = app.emit("toggle-language", "fr");
                }
                "lang_de" => {
                    let _ = app.emit("toggle-language", "de");
                }
                "lang_it" => {
                    let _ = app.emit("toggle-language", "it");
                }
                "lang_pt" => {
                    let _ = app.emit("toggle-language", "pt");
                }
                "lang_ja" => {
                    let _ = app.emit("toggle-language", "ja");
                }
                "lang_ko" => {
                    let _ = app.emit("toggle-language", "ko");
                }
                "lang_zh" => {
                    let _ = app.emit("toggle-language", "zh");
                }
                "lang_auto" => {
                    let _ = app.emit("toggle-auto-detect-language", ());
                }
                "settings" => {
                    println!("Settings clicked from tray");
                    let _ = app.emit("open-settings", ());
                }
                "quit" => {
                    println!("Quit clicked from tray");
                    app.exit(0);
                }
                _ => {
                    println!("Unhandled menu item: {:?}", event.id);
                }
            }
        })
        .on_tray_icon_event(|_tray, event| {
            // Explicitly handle tray icon events to prevent default left-click menu
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                ..
            } = event {
                println!("Left click on tray icon - doing nothing");
            }
        })
        .build(app)?;

    // Listen for settings changes to update the tray
    let app_handle = app.clone();
    app.listen("settings-changed", move |_| {
        println!("Settings changed, updating tray menu...");
        if let Err(e) = update_tray_menu(&app_handle) {
            eprintln!("Failed to update tray menu: {}", e);
        }
    });

    Ok(())
}

pub fn update_tray_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    // Rebuild the entire menu with updated settings
    let menu = build_tray_menu(app)?;

    // Get the tray icon and set the new menu
    if let Some(tray) = app.tray_by_id("main") {
        tray.set_menu(Some(menu))?;
    }

    Ok(())
}

use rdev::{listen, Event, EventType, Key};
use std::collections::HashSet;
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::Instant;
use tauri::{App, AppHandle, Emitter};
use tauri_nspanel::ManagerExt;
use tauri_plugin_store::{JsonValue, StoreExt};

/// Name of the Tauri storage
const DICTO_TAURI_STORE: &str = "dicto_tauri_store";

/// Key for storing global shortcuts
const DICTO_GLOBAL_SHORTCUT: &str = "dicto_global_shortcut";

/// Default shortcut - FN key
const DEFAULT_SHORTCUT: &str = "fn";

/// Maximum time a shortcut can be active before auto-reset (5 seconds)
/// This prevents stuck state when key release events are missed (common with FN key)
const SHORTCUT_TIMEOUT_SECS: u64 = 5;

/// Global state for the keyboard listener
static SHORTCUT_STATE: OnceLock<Arc<Mutex<ShortcutState>>> = OnceLock::new();

struct ShortcutState {
    target_keys: Vec<Key>,
    pressed_keys: HashSet<Key>,
    shortcut_active: bool,
    activated_at: Option<Instant>,
}

/// Set shortcut during application startup
pub fn enable_shortcut(app: &App) {
    let store = app
        .store(DICTO_TAURI_STORE)
        .expect("Creating the store should not fail");

    let shortcut_str = store
        .get(DICTO_GLOBAL_SHORTCUT)
        .and_then(|v| match v {
            JsonValue::String(s) => Some(s),
            _ => None,
        })
        .unwrap_or_else(|| {
            store.set(
                DICTO_GLOBAL_SHORTCUT,
                JsonValue::String(DEFAULT_SHORTCUT.to_string()),
            );
            DEFAULT_SHORTCUT.to_string()
        });

    let target_keys = parse_shortcut(&shortcut_str);
    println!(
        "🎹 Initializing shortcut: {} -> {:?}",
        shortcut_str, target_keys
    );

    let state = Arc::new(Mutex::new(ShortcutState {
        target_keys,
        pressed_keys: HashSet::new(),
        shortcut_active: false,
        activated_at: None,
    }));

    SHORTCUT_STATE.set(state.clone()).ok();

    let app_handle = app.handle().clone();
    thread::spawn(move || {
        start_listener(app_handle);
    });

    println!("✅ Global keyboard listener started");
}

fn start_listener(app: AppHandle) {
    let state = SHORTCUT_STATE.get().unwrap().clone();

    if let Err(e) = listen(move |event: Event| {
        let mut state = state.lock().unwrap();

        match event.event_type {
            EventType::KeyPress(key) => {
                // Check if shortcut is stuck (active for too long without release)
                if state.shortcut_active {
                    if let Some(activated_at) = state.activated_at {
                        if activated_at.elapsed().as_secs() > SHORTCUT_TIMEOUT_SECS {
                            println!("⚠️ Shortcut stuck for >{}s, auto-resetting", SHORTCUT_TIMEOUT_SECS);
                            state.shortcut_active = false;
                            state.activated_at = None;
                            state.pressed_keys.clear();
                        }
                    }
                }

                state.pressed_keys.insert(key);

                // Check if all target keys are pressed
                if !state.shortcut_active
                    && !state.target_keys.is_empty()
                    && state
                        .target_keys
                        .iter()
                        .all(|k| state.pressed_keys.contains(k))
                {
                    state.shortcut_active = true;
                    state.activated_at = Some(Instant::now());
                    println!("🔔 Shortcut activated! Emitting start-listening");
                    emit_event(&app, "start-listening");
                }
            }
            EventType::KeyRelease(key) => {
                state.pressed_keys.remove(&key);

                // Check if any target key was released
                if state.shortcut_active && state.target_keys.contains(&key) {
                    state.shortcut_active = false;
                    state.activated_at = None;
                    println!("🔔 Shortcut released! Emitting stop-listening");
                    emit_event(&app, "stop-listening");
                }
            }
            _ => {}
        }
    }) {
        eprintln!("❌ Failed to start global key listener: {:?}", e);
        eprintln!("💡 Make sure the app has accessibility permissions in System Settings");
        eprintln!("   Go to: System Settings > Privacy & Security > Accessibility");
    }
}

fn emit_event(app: &AppHandle, event_name: &str) {
    // Try to get the widget panel and emit directly
    let emitted = if let Ok(panel) = app.get_webview_panel("widget") {
        if let Some(widget_window) = panel.to_window() {
            match widget_window.emit(event_name, ()) {
                Ok(_) => {
                    println!("✅ Emitted {} directly to widget window", event_name);
                    true
                }
                Err(e) => {
                    eprintln!("❌ Direct emit failed: {:?}", e);
                    false
                }
            }
        } else {
            eprintln!("⚠️ Panel exists but cannot convert to window");
            false
        }
    } else {
        false
    };

    // Always fallback to broadcast if direct emit failed or panel not found
    if !emitted {
        println!("📡 Broadcasting {} event to all windows/panels", event_name);
        let _ = app.emit(event_name, ());
    }
}

/// Parse shortcut string like "ctrl+space" or "fn" into Vec<Key>
fn parse_shortcut(s: &str) -> Vec<Key> {
    s.split('+')
        .map(|part| string_to_key(part.trim()))
        .collect()
}

/// Convert string representation to rdev Key
fn string_to_key(s: &str) -> Key {
    match s.to_lowercase().as_str() {
        // Special keys
        "fn" | "function" => Key::Function,
        "capslock" | "caps" => Key::CapsLock,
        "ctrl" | "control" => Key::ControlLeft,
        "alt" | "option" => Key::Alt,
        "shift" => Key::ShiftLeft,
        "cmd" | "command" | "meta" => Key::MetaLeft,
        "space" => Key::Space,
        "tab" => Key::Tab,
        "escape" | "esc" => Key::Escape,
        "enter" | "return" => Key::Return,
        "backspace" => Key::Backspace,
        "delete" => Key::Delete,

        // Arrow keys
        "up" => Key::UpArrow,
        "down" => Key::DownArrow,
        "left" => Key::LeftArrow,
        "right" => Key::RightArrow,

        // Function keys
        "f1" => Key::F1,
        "f2" => Key::F2,
        "f3" => Key::F3,
        "f4" => Key::F4,
        "f5" => Key::F5,
        "f6" => Key::F6,
        "f7" => Key::F7,
        "f8" => Key::F8,
        "f9" => Key::F9,
        "f10" => Key::F10,
        "f11" => Key::F11,
        "f12" => Key::F12,

        // Letters
        "a" => Key::KeyA,
        "b" => Key::KeyB,
        "c" => Key::KeyC,
        "d" => Key::KeyD,
        "e" => Key::KeyE,
        "f" => Key::KeyF,
        "g" => Key::KeyG,
        "h" => Key::KeyH,
        "i" => Key::KeyI,
        "j" => Key::KeyJ,
        "k" => Key::KeyK,
        "l" => Key::KeyL,
        "m" => Key::KeyM,
        "n" => Key::KeyN,
        "o" => Key::KeyO,
        "p" => Key::KeyP,
        "q" => Key::KeyQ,
        "r" => Key::KeyR,
        "s" => Key::KeyS,
        "t" => Key::KeyT,
        "u" => Key::KeyU,
        "v" => Key::KeyV,
        "w" => Key::KeyW,
        "x" => Key::KeyX,
        "y" => Key::KeyY,
        "z" => Key::KeyZ,

        // Numbers
        "0" => Key::Num0,
        "1" => Key::Num1,
        "2" => Key::Num2,
        "3" => Key::Num3,
        "4" => Key::Num4,
        "5" => Key::Num5,
        "6" => Key::Num6,
        "7" => Key::Num7,
        "8" => Key::Num8,
        "9" => Key::Num9,

        _ => Key::Unknown(0),
    }
}

/// Get the current stored shortcut as a string
#[tauri::command]
#[specta::specta]
pub fn get_current_shortcut(app: tauri::AppHandle) -> Result<String, String> {
    let store = app.get_store(DICTO_TAURI_STORE).ok_or("Store not found")?;

    Ok(store
        .get(DICTO_GLOBAL_SHORTCUT)
        .and_then(|v| match v {
            JsonValue::String(s) => Some(s),
            _ => None,
        })
        .unwrap_or_else(|| DEFAULT_SHORTCUT.to_string()))
}

/// Change the global shortcut
#[tauri::command]
#[specta::specta]
pub fn change_shortcut(app: tauri::AppHandle, key: String) -> Result<(), String> {
    println!("Changing shortcut to: {}", key);

    // Store the new shortcut
    let store = app.get_store(DICTO_TAURI_STORE).ok_or("Store not found")?;
    store.set(DICTO_GLOBAL_SHORTCUT, JsonValue::String(key.clone()));

    // Update runtime state
    if let Some(state) = SHORTCUT_STATE.get() {
        let mut state = state.lock().unwrap();
        state.target_keys = parse_shortcut(&key);
        state.shortcut_active = false;
        state.activated_at = None;
        state.pressed_keys.clear();
        println!("✅ Shortcut updated to: {:?}", state.target_keys);
    }

    Ok(())
}

/// Unregister the current shortcut (clears the target keys)
#[tauri::command]
#[specta::specta]
pub fn unregister_shortcut(_app: tauri::AppHandle) -> Result<(), String> {
    if let Some(state) = SHORTCUT_STATE.get() {
        let mut state = state.lock().unwrap();
        state.target_keys.clear();
        state.shortcut_active = false;
        state.activated_at = None;
        state.pressed_keys.clear();
        println!("✅ Shortcut unregistered");
    }
    Ok(())
}

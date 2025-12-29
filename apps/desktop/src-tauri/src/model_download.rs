use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Manager};

/// If a directory contains only a single subdirectory, move its contents up.
/// This handles tars that contain a top-level folder.
fn flatten_nested_folder(dir: &Path) -> std::io::Result<()> {
    let entries: Vec<_> = fs::read_dir(dir)?.filter_map(|e| e.ok()).collect();

    // Check if there's exactly one entry and it's a directory
    if entries.len() == 1 {
        let entry = &entries[0];
        if entry.file_type()?.is_dir() {
            let nested_dir = entry.path();
            println!("Flattening nested folder: {:?}", nested_dir);

            // Move all contents from nested folder to parent
            for nested_entry in fs::read_dir(&nested_dir)? {
                let nested_entry = nested_entry?;
                let src = nested_entry.path();
                let dest = dir.join(nested_entry.file_name());

                // Use rename for efficiency (same filesystem)
                fs::rename(&src, &dest)?;
            }

            // Remove the now-empty nested directory
            fs::remove_dir(&nested_dir)?;
            println!("✅ Flattened nested folder structure");
        }
    }

    Ok(())
}

/// Speech-to-Text models
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type, PartialEq)]
pub enum SttModel {
    Whisper,
}

/// Large Language Models (Text-to-Text)
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type, PartialEq)]
pub enum LlmModel {
    Qwen,
}

/// Common trait for downloadable models
trait DownloadableModel {
    fn url(&self) -> &'static str;
    fn filename(&self) -> &'static str;
    fn display_name(&self) -> &'static str;
    fn extracted_folder(&self) -> Option<&'static str>;
    fn model_dir(&self) -> &'static str;
}

impl DownloadableModel for SttModel {
    fn url(&self) -> &'static str {
        match self {
            SttModel::Whisper => {
                "https://bikhwis00a.ufs.sh/f/h7fo4nF4JUG5sUZCah8euX3BLg9ApnPrdlmKHOkNh84zboSi"
            }
        }
    }

    fn filename(&self) -> &'static str {
        match self {
            SttModel::Whisper => "ggml-small-q8_0.bin",
        }
    }

    fn display_name(&self) -> &'static str {
        match self {
            SttModel::Whisper => "Whisper Small",
        }
    }

    fn extracted_folder(&self) -> Option<&'static str> {
        match self {
            SttModel::Whisper => None,
        }
    }

    fn model_dir(&self) -> &'static str {
        "stt"
    }
}

impl DownloadableModel for LlmModel {
    fn url(&self) -> &'static str {
        match self {
            LlmModel::Qwen => {
                "https://bikhwis00a.ufs.sh/f/h7fo4nF4JUG5J0IwOJo81CvgA5JmjP0WpaT6RHNGnyStrZde"
            }
        }
    }

    fn filename(&self) -> &'static str {
        match self {
            LlmModel::Qwen => "qwen-0.5b-q8_0.gguf",
        }
    }

    fn display_name(&self) -> &'static str {
        match self {
            LlmModel::Qwen => "Qwen 0.5B",
        }
    }

    fn extracted_folder(&self) -> Option<&'static str> {
        match self {
            LlmModel::Qwen => None,
        }
    }

    fn model_dir(&self) -> &'static str {
        "llm"
    }
}

/// Status of an STT model
#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct SttModelStatus {
    pub model: SttModel,
    pub downloaded: bool,
    pub file_size: Option<f64>,
    pub path: Option<String>,
}

/// Status of an LLM model
#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct LlmModelStatus {
    pub model: LlmModel,
    pub downloaded: bool,
    pub file_size: Option<f64>,
    pub path: Option<String>,
}

/// Progress event payload
#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct DownloadProgress {
    pub model: String,
    pub downloaded: f64,
    pub total: f64,
    pub percentage: f32,
}

/// Completion event payload
#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct DownloadComplete {
    pub model: String,
}

/// Error event payload
#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct DownloadError {
    pub model: String,
    pub error: String,
}

/// Get the models directory path for a specific model type
fn get_model_dir_for<M: DownloadableModel>(app: &AppHandle, model: &M) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    let model_dir = app_data_dir.join(model.model_dir());

    // Ensure directory exists
    if !model_dir.exists() {
        fs::create_dir_all(&model_dir)
            .map_err(|e| format!("Failed to create {} directory: {}", model.model_dir(), e))?;
    }

    Ok(model_dir)
}

/// Get the path for a specific model
fn get_model_path_for<M: DownloadableModel>(app: &AppHandle, model: &M) -> Result<PathBuf, String> {
    let model_dir = get_model_dir_for(app, model)?;

    // For archive-based models, check for extracted folder; for others, check the file
    if let Some(folder) = model.extracted_folder() {
        Ok(model_dir.join(folder))
    } else {
        Ok(model_dir.join(model.filename()))
    }
}

/// Check model status helper
fn check_model_status_impl<M: DownloadableModel>(
    app: &AppHandle,
    model: &M,
) -> Result<(bool, Option<f64>, Option<String>), String> {
    let model_path = get_model_path_for(app, model)?;

    let (downloaded, file_size) = if model_path.exists() {
        if model_path.is_dir() {
            let size = fs_extra::dir::get_size(&model_path).unwrap_or(0);
            (true, Some(size as f64))
        } else {
            let metadata = fs::metadata(&model_path)
                .map_err(|e| format!("Failed to read file metadata: {}", e))?;
            (true, Some(metadata.len() as f64))
        }
    } else {
        (false, None)
    };

    let path = if downloaded {
        Some(model_path.to_string_lossy().to_string())
    } else {
        None
    };

    Ok((downloaded, file_size, path))
}

/// Check if an STT model is downloaded and get its status
#[tauri::command]
#[specta::specta]
pub async fn check_stt_model_status(
    app: AppHandle,
    model: SttModel,
) -> Result<SttModelStatus, String> {
    let (downloaded, file_size, path) = check_model_status_impl(&app, &model)?;
    Ok(SttModelStatus {
        model,
        downloaded,
        file_size,
        path,
    })
}

/// Check if an LLM model is downloaded and get its status
#[tauri::command]
#[specta::specta]
pub async fn check_llm_model_status(
    app: AppHandle,
    model: LlmModel,
) -> Result<LlmModelStatus, String> {
    let (downloaded, file_size, path) = check_model_status_impl(&app, &model)?;
    Ok(LlmModelStatus {
        model,
        downloaded,
        file_size,
        path,
    })
}

/// Download model helper
async fn download_model_helper<M: DownloadableModel + Send + 'static>(
    app: AppHandle,
    model: M,
) -> Result<(), String> {
    let model_dir = get_model_dir_for(&app, &model)?;
    let model_name = model.display_name().to_string();
    let url = model.url().to_string();
    let filename = model.filename().to_string();
    let extracted_folder = model.extracted_folder().map(|s| s.to_string());

    // Spawn background download task
    tokio::spawn(async move {
        let result = download_model_impl(
            &app,
            &model_name,
            &url,
            &model_dir,
            &filename,
            extracted_folder.as_deref(),
            false, // plain .tar, not .tar.gz
        )
        .await;

        match result {
            Ok(_) => {
                let _ = app.emit(
                    "model-download-complete",
                    DownloadComplete {
                        model: model_name.clone(),
                    },
                );
                println!("✅ Model {} downloaded successfully", model_name);
            }
            Err(e) => {
                let _ = app.emit(
                    "model-download-error",
                    DownloadError {
                        model: model_name.clone(),
                        error: e.clone(),
                    },
                );
                eprintln!("❌ Failed to download model {}: {}", model_name, e);
            }
        }
    });

    Ok(())
}

/// Download an STT model in the background
#[tauri::command]
#[specta::specta]
pub async fn download_stt_model(app: AppHandle, model: SttModel) -> Result<(), String> {
    download_model_helper(app, model).await
}

/// Download an LLM model in the background
#[tauri::command]
#[specta::specta]
pub async fn download_llm_model(app: AppHandle, model: LlmModel) -> Result<(), String> {
    download_model_helper(app, model).await
}

/// Internal implementation of model download with streaming
async fn download_model_impl(
    app: &AppHandle,
    model_name: &str,
    url: &str,
    stt_dir: &PathBuf,
    filename: &str,
    extracted_folder: Option<&str>,
    is_tar_gz: bool,
) -> Result<(), String> {
    // Disable automatic decompression to get raw bytes for large binary files
    let client = reqwest::Client::builder()
        .no_gzip()
        .no_brotli()
        .no_deflate()
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    // Start the download request
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Failed to start download: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Download failed with status: {}",
            response.status()
        ));
    }

    let total_size = response.content_length().unwrap_or(0);
    let download_path = stt_dir.join(format!("{}.part", filename));
    let final_path = stt_dir.join(filename);

    // Create the file for writing
    let mut file = fs::File::create(&download_path)
        .map_err(|e| format!("Failed to create download file: {}", e))?;

    let mut downloaded: u64 = 0;
    let mut last_emit_percentage: f32 = 0.0;

    // Stream the response body
    let mut stream = response.bytes_stream();
    use futures::StreamExt;

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("Failed to read chunk: {}", e))?;

        file.write_all(&chunk)
            .map_err(|e| format!("Failed to write chunk: {}", e))?;

        downloaded += chunk.len() as u64;

        // Emit progress every 1% or every 10MB, whichever comes first
        let percentage = if total_size > 0 {
            (downloaded as f32 / total_size as f32) * 100.0
        } else {
            0.0
        };

        if percentage - last_emit_percentage >= 1.0
            || downloaded % (10 * 1024 * 1024) < chunk.len() as u64
        {
            last_emit_percentage = percentage;
            let _ = app.emit(
                "model-download-progress",
                DownloadProgress {
                    model: model_name.to_string(),
                    downloaded: downloaded as f64,
                    total: total_size as f64,
                    percentage,
                },
            );
        }
    }

    // Flush and close the file
    file.flush()
        .map_err(|e| format!("Failed to flush file: {}", e))?;
    drop(file);

    // Rename .part file to final filename
    fs::rename(&download_path, &final_path)
        .map_err(|e| format!("Failed to rename downloaded file: {}", e))?;

    // Extract archive-based models
    if let Some(folder_name) = extracted_folder {
        let extract_dir = stt_dir.join(folder_name);

        // Create extraction directory
        if extract_dir.exists() {
            fs::remove_dir_all(&extract_dir)
                .map_err(|e| format!("Failed to clean existing extraction dir: {}", e))?;
        }
        fs::create_dir_all(&extract_dir)
            .map_err(|e| format!("Failed to create extraction dir: {}", e))?;

        if is_tar_gz {
            // Extract the tar.gz
            let tar_gz = fs::File::open(&final_path)
                .map_err(|e| format!("Failed to open tar.gz file: {}", e))?;

            let tar = flate2::read::GzDecoder::new(tar_gz);
            let mut archive = tar::Archive::new(tar);

            archive
                .unpack(&extract_dir)
                .map_err(|e| format!("Failed to extract tar.gz: {}", e))?;
        } else {
            // Use system tar command for better compatibility with macOS-created tars
            let output = std::process::Command::new("tar")
                .arg("-xf")
                .arg(&final_path)
                .arg("-C")
                .arg(&extract_dir)
                .output()
                .map_err(|e| format!("Failed to run tar command: {}", e))?;

            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                return Err(format!("tar extraction failed: {}", stderr));
            }
        }

        // Flatten nested folder if present (e.g., tar contains a single top-level folder)
        flatten_nested_folder(&extract_dir)
            .map_err(|e| format!("Failed to flatten folder: {}", e))?;

        // Remove archive after extraction
        let _ = fs::remove_file(&final_path);

        println!("✅ Extracted {} to {:?}", folder_name, extract_dir);
    }

    // Emit final 100% progress
    let _ = app.emit(
        "model-download-progress",
        DownloadProgress {
            model: model_name.to_string(),
            downloaded: total_size as f64,
            total: total_size as f64,
            percentage: 100.0,
        },
    );

    Ok(())
}

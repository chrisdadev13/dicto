use anyhow::Result;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Sample, SampleFormat};
use serde::Deserialize;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_store::StoreExt;
use tokio::sync::Mutex;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

use crate::formatter::format_text;

/// Saves a transcription to the local SQLite database.
fn save_transcription_to_db(
    app: &AppHandle,
    text: &str,
    formatted_text: Option<&str>,
) -> Result<String, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    let db_path = app_data_dir.join("dicto.db");

    let conn = rusqlite::Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {:?}: {}", db_path, e))?;

    let id = uuid::Uuid::new_v4().to_string();
    let created_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("Failed to get timestamp: {}", e))?
        .as_secs() as i64;

    // Use formatted_text if provided, otherwise use raw text
    let formatted = formatted_text.unwrap_or(text);
    conn.execute(
        "INSERT INTO transcriptions (id, text, formatted_text, created_at) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![id, text, formatted, created_at],
    )
    .map_err(|e| format!("Failed to insert transcription: {}", e))?;

    println!("✅ Saved local transcription with id: {}", id);

    Ok(id)
}

#[derive(Debug, Clone, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionSettings {
    pub auto_detect_language: bool,
    pub languages: Vec<String>,
    /// Keyterms to boost recognition (technical terms, proper nouns, acronyms)
    pub keyterms: Vec<String>,
    /// Whether to use cloud transcription (AssemblyAI)
    pub use_cloud: bool,
}

impl Default for TranscriptionSettings {
    fn default() -> Self {
        Self {
            auto_detect_language: false,
            languages: vec!["en-US".to_string()],
            keyterms: Vec::new(),
            use_cloud: false,
        }
    }
}

// ============================================================================
// Chunked Processing Constants and Types
// ============================================================================

/// Sample rate for transcription (Whisper requires 16kHz)
const TRANSCRIPTION_SAMPLE_RATE: u32 = 16000;

/// Chunk duration in seconds (~5 for good balance of latency and accuracy)
const CHUNK_DURATION_SECS: f32 = 5.0;

/// Overlap duration in seconds (prevents cutting words at boundaries)
const OVERLAP_DURATION_SECS: f32 = 0.5;

/// Number of samples per chunk (5s * 16000 samples/s = 480,000)
const CHUNK_SIZE_SAMPLES: usize = (TRANSCRIPTION_SAMPLE_RATE as f32 * CHUNK_DURATION_SECS) as usize;

/// Number of overlap samples (0.5s * 16000 = 8,000)
const OVERLAP_SAMPLES: usize = (TRANSCRIPTION_SAMPLE_RATE as f32 * OVERLAP_DURATION_SECS) as usize;

/// Maximum retries for failed chunk transcription
const MAX_CHUNK_RETRIES: usize = 2;

/// State of an audio chunk in the processing pipeline
#[derive(Debug, Clone, PartialEq)]
pub enum ChunkState {
    /// Chunk is ready but not yet processed
    Pending,
    /// Currently being transcribed
    Processing,
    /// Successfully transcribed
    Completed,
    /// Transcription failed after retries
    Failed,
}

/// An audio chunk with its transcription state
#[derive(Debug, Clone)]
pub struct AudioChunk {
    /// Sequential chunk ID
    pub id: usize,
    /// Audio samples (mono, 16kHz, f32 normalized)
    pub samples: Vec<f32>,
    /// Start position in overall recording (sample index)
    pub start_sample_idx: usize,
    /// End position in overall recording (sample index)
    pub end_sample_idx: usize,
    /// Current processing state
    pub state: ChunkState,
    /// Transcription result when completed
    pub transcription: Option<String>,
    /// Error message if failed
    pub error: Option<String>,
}

/// Processes audio chunks in background during recording
pub struct ChunkProcessor {
    /// Reference to the raw audio sample buffer (shared with audio capture)
    samples: Arc<std::sync::Mutex<Vec<f32>>>,
    /// Queue of audio chunks being processed
    chunks: Arc<std::sync::Mutex<Vec<AudioChunk>>>,
    /// Next chunk ID counter
    next_chunk_id: Arc<AtomicUsize>,
    /// How many samples have been chunked so far
    samples_chunked: Arc<AtomicUsize>,
    /// Signal to stop processing
    should_stop: Arc<AtomicBool>,
    /// Whether chunk worker is currently processing
    is_processing: Arc<AtomicBool>,
    /// Path to the Whisper model file
    model_path: PathBuf,
    /// Whether to auto-detect language
    auto_detect_language: bool,
    /// Languages for transcription
    languages: Vec<String>,
    /// Keyterms for vocabulary boosting
    keyterms: Vec<String>,
    /// Sample rate of input audio (before resampling)
    input_sample_rate: u32,
    /// Number of channels in input audio
    input_channels: u16,
}

impl ChunkProcessor {
    /// Create a new ChunkProcessor
    pub fn new(
        samples: Arc<std::sync::Mutex<Vec<f32>>>,
        model_path: PathBuf,
        auto_detect_language: bool,
        languages: Vec<String>,
        keyterms: Vec<String>,
        input_sample_rate: u32,
        input_channels: u16,
    ) -> Self {
        Self {
            samples,
            chunks: Arc::new(std::sync::Mutex::new(Vec::new())),
            next_chunk_id: Arc::new(AtomicUsize::new(0)),
            samples_chunked: Arc::new(AtomicUsize::new(0)),
            should_stop: Arc::new(AtomicBool::new(false)),
            is_processing: Arc::new(AtomicBool::new(false)),
            model_path,
            auto_detect_language,
            languages,
            keyterms,
            input_sample_rate,
            input_channels,
        }
    }

    /// Signal the processor to stop accepting new chunks
    pub fn signal_stop(&self) {
        self.should_stop.store(true, Ordering::SeqCst);
    }

    /// Check if processing should stop
    pub fn should_stop(&self) -> bool {
        self.should_stop.load(Ordering::SeqCst)
    }

    /// Check if worker is currently processing a chunk
    pub fn is_processing(&self) -> bool {
        self.is_processing.load(Ordering::SeqCst)
    }

    /// Get the number of samples that have been chunked
    pub fn samples_chunked(&self) -> usize {
        self.samples_chunked.load(Ordering::SeqCst)
    }

    /// Extract the next chunk from the sample buffer if enough samples available
    fn extract_next_chunk(&self) -> Option<AudioChunk> {
        let buffer = self.samples.lock().ok()?;
        let already_chunked = self.samples_chunked.load(Ordering::SeqCst);

        // Calculate how many new samples we need (accounting for resampling)
        // Input buffer is at input_sample_rate, we need to resample to 16kHz
        let resample_ratio = self.input_sample_rate as f64 / TRANSCRIPTION_SAMPLE_RATE as f64;
        let channels = self.input_channels as usize;

        // Calculate needed input samples for one chunk
        // After mono conversion: input_samples / channels
        // After resampling: (input_samples / channels) / resample_ratio = CHUNK_SIZE_SAMPLES
        // So: input_samples = CHUNK_SIZE_SAMPLES * resample_ratio * channels
        let needed_input_samples =
            (CHUNK_SIZE_SAMPLES as f64 * resample_ratio * channels as f64) as usize;

        // Calculate start position with overlap (in input sample space)
        let overlap_input_samples =
            (OVERLAP_SAMPLES as f64 * resample_ratio * channels as f64) as usize;

        let start_idx = if already_chunked > 0 {
            already_chunked.saturating_sub(overlap_input_samples)
        } else {
            0
        };

        let end_idx = start_idx + needed_input_samples;

        // Check if we have enough samples
        if end_idx > buffer.len() {
            return None;
        }

        // Extract raw samples
        let raw_samples = buffer[start_idx..end_idx].to_vec();
        drop(buffer); // Release lock

        // Convert to mono if needed
        let mono_samples = if channels > 1 {
            let mut mono = Vec::with_capacity(raw_samples.len() / channels);
            for chunk in raw_samples.chunks(channels) {
                let avg: f32 = chunk.iter().sum::<f32>() / channels as f32;
                mono.push(avg);
            }
            mono
        } else {
            raw_samples
        };

        // Resample to 16kHz if needed
        let resampled = if self.input_sample_rate != TRANSCRIPTION_SAMPLE_RATE {
            resample_audio(
                &mono_samples,
                self.input_sample_rate,
                TRANSCRIPTION_SAMPLE_RATE,
            )
        } else {
            mono_samples
        };

        let chunk_id = self.next_chunk_id.fetch_add(1, Ordering::SeqCst);

        // Update samples_chunked to point past this chunk (minus overlap for next)
        self.samples_chunked.store(end_idx, Ordering::SeqCst);

        Some(AudioChunk {
            id: chunk_id,
            samples: resampled,
            start_sample_idx: start_idx,
            end_sample_idx: end_idx,
            state: ChunkState::Pending,
            transcription: None,
            error: None,
        })
    }

    /// Add a chunk to the processing queue
    fn add_chunk(&self, chunk: AudioChunk) {
        if let Ok(mut chunks) = self.chunks.lock() {
            println!(
                "ChunkProcessor: Added chunk {} with {} samples",
                chunk.id,
                chunk.samples.len()
            );
            chunks.push(chunk);
        }
    }

    /// Get the next pending chunk index
    fn get_next_pending_chunk_idx(&self) -> Option<usize> {
        let chunks = self.chunks.lock().ok()?;
        chunks.iter().position(|c| c.state == ChunkState::Pending)
    }

    /// Process any remaining audio that didn't fill a complete chunk
    pub fn process_final_chunk(&self) {
        let buffer = match self.samples.lock() {
            Ok(b) => b,
            Err(_) => return,
        };

        let already_chunked = self.samples_chunked.load(Ordering::SeqCst);

        if already_chunked >= buffer.len() {
            // All samples already chunked
            return;
        }

        let remaining = buffer[already_chunked..].to_vec();
        drop(buffer);

        if remaining.is_empty() {
            return;
        }

        let channels = self.input_channels as usize;

        // Convert to mono
        let mono_samples = if channels > 1 {
            let mut mono = Vec::with_capacity(remaining.len() / channels);
            for chunk in remaining.chunks(channels) {
                let avg: f32 = chunk.iter().sum::<f32>() / channels as f32;
                mono.push(avg);
            }
            mono
        } else {
            remaining
        };

        // Resample to 16kHz
        let resampled = if self.input_sample_rate != TRANSCRIPTION_SAMPLE_RATE {
            resample_audio(
                &mono_samples,
                self.input_sample_rate,
                TRANSCRIPTION_SAMPLE_RATE,
            )
        } else {
            mono_samples
        };

        if resampled.is_empty() {
            return;
        }

        let chunk_id = self.next_chunk_id.fetch_add(1, Ordering::SeqCst);

        let final_chunk = AudioChunk {
            id: chunk_id,
            samples: resampled,
            start_sample_idx: already_chunked,
            end_sample_idx: already_chunked, // Marker for final chunk
            state: ChunkState::Pending,
            transcription: None,
            error: None,
        };

        println!(
            "ChunkProcessor: Added final chunk {} with {} samples",
            final_chunk.id,
            final_chunk.samples.len()
        );

        self.add_chunk(final_chunk);
    }

    /// Wait for all pending chunks to complete processing
    pub fn wait_for_completion(&self, timeout: Duration) -> bool {
        let start = std::time::Instant::now();

        loop {
            if start.elapsed() > timeout {
                println!("ChunkProcessor: Timeout waiting for completion");
                return false;
            }

            let all_done = {
                let chunks = match self.chunks.lock() {
                    Ok(c) => c,
                    Err(_) => return false,
                };
                chunks
                    .iter()
                    .all(|c| c.state == ChunkState::Completed || c.state == ChunkState::Failed)
            };

            if all_done {
                return true;
            }

            thread::sleep(Duration::from_millis(50));
        }
    }

    /// Merge all completed chunk transcriptions with overlap deduplication
    pub fn merge_results(&self) -> String {
        let chunks = match self.chunks.lock() {
            Ok(c) => c,
            Err(_) => return String::new(),
        };

        let mut results: Vec<&str> = Vec::new();

        for chunk in chunks.iter() {
            if chunk.state == ChunkState::Completed {
                if let Some(text) = &chunk.transcription {
                    let trimmed = text.trim();
                    if !trimmed.is_empty() {
                        results.push(trimmed);
                    }
                }
            } else if chunk.state == ChunkState::Failed {
                println!(
                    "ChunkProcessor: Chunk {} failed: {:?}",
                    chunk.id, chunk.error
                );
            }
        }

        if results.is_empty() {
            return String::new();
        }

        if results.len() == 1 {
            return results[0].to_string();
        }

        // Merge with overlap deduplication
        let mut merged = results[0].to_string();

        for text in results.iter().skip(1) {
            merged = merge_with_overlap_dedup(&merged, text);
        }

        merged
    }

    /// Spawn the chunk monitor thread that creates chunks from the sample buffer
    pub fn spawn_chunk_monitor(self: &Arc<Self>) -> thread::JoinHandle<()> {
        let processor = Arc::clone(self);

        thread::spawn(move || {
            println!("ChunkProcessor: Monitor thread started");

            loop {
                if processor.should_stop() {
                    println!("ChunkProcessor: Monitor thread stopping");
                    break;
                }

                // Try to extract next chunk
                if let Some(chunk) = processor.extract_next_chunk() {
                    processor.add_chunk(chunk);
                }

                // Sleep briefly before checking again
                thread::sleep(Duration::from_millis(100));
            }

            println!("ChunkProcessor: Monitor thread ended");
        })
    }

    /// Spawn the chunk worker thread that transcribes pending chunks
    pub fn spawn_chunk_worker(self: &Arc<Self>) -> thread::JoinHandle<()> {
        let processor = Arc::clone(self);

        thread::spawn(move || {
            println!("ChunkProcessor: Worker thread started");

            // Load model once for reuse
            let mut whisper_ctx: Option<WhisperContext> = None;

            loop {
                // Find next pending chunk
                let chunk_idx = processor.get_next_pending_chunk_idx();

                match chunk_idx {
                    Some(idx) => {
                        processor.is_processing.store(true, Ordering::SeqCst);

                        // Get chunk samples and mark as processing
                        let (chunk_id, samples) = {
                            let mut chunks = match processor.chunks.lock() {
                                Ok(c) => c,
                                Err(_) => {
                                    processor.is_processing.store(false, Ordering::SeqCst);
                                    continue;
                                }
                            };
                            chunks[idx].state = ChunkState::Processing;
                            (chunks[idx].id, chunks[idx].samples.clone())
                        };

                        println!(
                            "ChunkProcessor: Processing chunk {} ({} samples)",
                            chunk_id,
                            samples.len()
                        );

                        // Transcribe chunk with retry
                        let result = processor.transcribe_chunk_with_retry(
                            &samples,
                            &mut whisper_ctx,
                            MAX_CHUNK_RETRIES,
                        );

                        // Update chunk with result
                        if let Ok(mut chunks) = processor.chunks.lock() {
                            match result {
                                Ok(text) => {
                                    println!(
                                        "ChunkProcessor: Chunk {} completed: '{}'",
                                        chunk_id,
                                        if text.len() > 50 {
                                            format!("{}...", &text[..50])
                                        } else {
                                            text.clone()
                                        }
                                    );
                                    chunks[idx].state = ChunkState::Completed;
                                    chunks[idx].transcription = Some(text);
                                    // Clear samples to free memory
                                    chunks[idx].samples.clear();
                                    chunks[idx].samples.shrink_to_fit();
                                }
                                Err(e) => {
                                    println!("ChunkProcessor: Chunk {} failed: {}", chunk_id, e);
                                    chunks[idx].state = ChunkState::Failed;
                                    chunks[idx].error = Some(e);
                                    chunks[idx].samples.clear();
                                    chunks[idx].samples.shrink_to_fit();
                                }
                            }
                        }

                        processor.is_processing.store(false, Ordering::SeqCst);
                    }
                    None => {
                        // No pending chunks
                        if processor.should_stop() {
                            // Check one more time for any pending chunks
                            let has_pending = processor
                                .chunks
                                .lock()
                                .map(|c| c.iter().any(|chunk| chunk.state == ChunkState::Pending))
                                .unwrap_or(false);

                            if !has_pending {
                                println!("ChunkProcessor: Worker thread stopping (all done)");
                                break;
                            }
                        }

                        thread::sleep(Duration::from_millis(50));
                    }
                }
            }

            println!("ChunkProcessor: Worker thread ended");
        })
    }

    /// Transcribe a chunk with retry logic
    fn transcribe_chunk_with_retry(
        &self,
        samples: &[f32],
        whisper_ctx: &mut Option<WhisperContext>,
        max_retries: usize,
    ) -> Result<String, String> {
        let mut attempts = 0;

        loop {
            let result = self.transcribe_chunk(samples, whisper_ctx);

            match result {
                Ok(text) => return Ok(text),
                Err(e) if attempts < max_retries => {
                    println!(
                        "ChunkProcessor: Transcription attempt {} failed: {}",
                        attempts + 1,
                        e
                    );
                    attempts += 1;
                    thread::sleep(Duration::from_millis(100));
                }
                Err(e) => return Err(e.to_string()),
            }
        }
    }

    /// Transcribe a single chunk using Whisper
    fn transcribe_chunk(
        &self,
        samples: &[f32],
        whisper_ctx: &mut Option<WhisperContext>,
    ) -> Result<String> {
        // Initialize context if not already loaded
        if whisper_ctx.is_none() {
            let ctx = WhisperContext::new_with_params(
                self.model_path.to_str().unwrap(),
                WhisperContextParameters::default(),
            )
            .map_err(|e| anyhow::anyhow!("Failed to load Whisper model: {}", e))?;
            *whisper_ctx = Some(ctx);
        }

        let ctx = whisper_ctx.as_ref().unwrap();
        let mut state = ctx
            .create_state()
            .map_err(|e| anyhow::anyhow!("Failed to create Whisper state: {}", e))?;

        // Configure parameters
        let mut params = FullParams::new(SamplingStrategy::BeamSearch {
            beam_size: 3,
            patience: -1.0,
        });

        // Set language
        if self.auto_detect_language || self.languages.is_empty() {
            params.set_language(None);
        } else {
            let whisper_lang = to_whisper_lang(&self.languages[0]);
            params.set_language(whisper_lang);
        }

        params.set_print_special(false);
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_timestamps(false);
        params.set_suppress_blank(true);
        params.set_suppress_nst(true);

        // Set keyterms as initial prompt
        if !self.keyterms.is_empty() {
            let prompt = format!("Terms: {}.", self.keyterms.join(", "));
            let truncated = if prompt.len() > 800 {
                format!("{}...", &prompt[..800])
            } else {
                prompt
            };
            params.set_initial_prompt(&truncated);
        }

        // Run transcription
        state
            .full(params, samples)
            .map_err(|e| anyhow::anyhow!("Whisper transcription failed: {}", e))?;

        // Collect results
        let mut text = String::new();
        let num_segments = state
            .full_n_segments()
            .map_err(|e| anyhow::anyhow!("Failed to get segments: {}", e))?;

        for i in 0..num_segments {
            if let Ok(segment) = state.full_get_segment_text(i) {
                text.push_str(&segment);
                text.push(' ');
            }
        }

        Ok(text.trim().to_string())
    }
}

/// Merge two text segments with overlap deduplication
fn merge_with_overlap_dedup(text_a: &str, text_b: &str) -> String {
    let words_a: Vec<&str> = text_a.split_whitespace().collect();
    let words_b: Vec<&str> = text_b.split_whitespace().collect();

    if words_a.is_empty() {
        return text_b.to_string();
    }
    if words_b.is_empty() {
        return text_a.to_string();
    }

    // Look for overlapping words at the junction (up to 5 words)
    let max_overlap = 5.min(words_a.len()).min(words_b.len());

    for overlap_len in (1..=max_overlap).rev() {
        let suffix_a = &words_a[words_a.len() - overlap_len..];
        let prefix_b = &words_b[..overlap_len];

        // Case-insensitive comparison for better matching
        let matches = suffix_a
            .iter()
            .zip(prefix_b.iter())
            .all(|(a, b)| a.to_lowercase() == b.to_lowercase());

        if matches {
            // Found overlap, merge without duplicating
            let mut merged = words_a.join(" ");
            if overlap_len < words_b.len() {
                merged.push(' ');
                merged.push_str(&words_b[overlap_len..].join(" "));
            }
            return merged;
        }
    }

    // No overlap found, simple concatenation
    format!("{} {}", text_a, text_b)
}

/// Convert language code to Whisper language format
fn to_whisper_lang(lang: &str) -> Option<&'static str> {
    match lang {
        "en-US" | "en-GB" => Some("en"),
        "es" => Some("es"),
        "fr" => Some("fr"),
        "de" => Some("de"),
        "it" => Some("it"),
        "pt" => Some("pt"),
        "ja" => Some("ja"),
        "ko" => Some("ko"),
        "zh" => Some("zh"),
        _ => None,
    }
}

/// Macro for local audio capture - accumulates f32 samples for Whisper
macro_rules! create_local_stream {
    ($device:ident, $config:expr, $samples:ident, $sample_type:ty, $app:ident, $last_emit:ident, $is_active:ident, $stop_tx:ident) => {{
        let app_clone = $app.clone();
        let last_emit_clone = $last_emit.clone();
        let is_active_clone = $is_active.clone();
        let samples_clone = $samples.clone();
        $device
            .build_input_stream(
                &$config.into(),
                move |data: &[$sample_type], _: &_| {
                    // Check if recording is still active
                    if !is_active_clone.load(Ordering::Relaxed) {
                        return;
                    }

                    // Calculate audio level for visualization
                    let mut sum: f64 = 0.0;
                    let mut f32_samples: Vec<f32> = Vec::with_capacity(data.len());

                    for sample in data {
                        let sample_value: i16 = sample.to_sample();
                        // Convert to f32 normalized [-1.0, 1.0]
                        let f32_sample = sample_value as f32 / 32768.0;
                        f32_samples.push(f32_sample);
                        sum += (sample_value as f64).abs();
                    }

                    // Accumulate samples for Whisper
                    if let Ok(mut samples_guard) = samples_clone.lock() {
                        samples_guard.extend(f32_samples);
                    }

                    // Calculate average amplitude (0-100 scale)
                    let avg_amplitude = (sum / data.len() as f64) / 327.68;

                    // Throttle event emission to ~30fps (every ~33ms)
                    let now = SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap()
                        .as_millis() as u64;
                    let last = last_emit_clone.load(Ordering::Relaxed);

                    if now - last >= 33 {
                        last_emit_clone.store(now, Ordering::Relaxed);
                        println!("Emitting audio level: {:.2}", avg_amplitude);
                        let _ = app_clone.emit("audio-level", avg_amplitude);
                    }
                },
                |err| eprintln!("Audio stream error: {:?}", err),
                None,
            )
            .map_err(|e| anyhow::anyhow!("Failed to build audio stream: {}", e))
    }};
}

/// Local microphone capture - accumulates samples for Whisper transcription
fn start_local_microphone(
    app: AppHandle,
    is_active: Arc<AtomicBool>,
    samples: Arc<std::sync::Mutex<Vec<f32>>>,
) -> Result<(u32, u16, crossbeam_channel::Sender<()>)> {
    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or_else(|| anyhow::anyhow!("No input device available"))?;
    let config = device
        .default_input_config()
        .map_err(|e| anyhow::anyhow!("Failed to get input config: {}", e))?;

    let sample_rate = config.sample_rate().0;
    let channels = config.channels();

    println!(
        "Local audio config - sample_rate: {}, channels: {}",
        sample_rate, channels
    );

    let (stop_tx, stop_rx) = crossbeam_channel::bounded::<()>(1);
    let last_emit = Arc::new(AtomicU64::new(0));

    let samples_for_thread = samples.clone();
    let is_active_for_thread = is_active.clone();
    let app_for_thread = app.clone();
    let last_emit_for_thread = last_emit.clone();
    let config_clone = config.clone();

    thread::spawn(move || {
        let stream_result = match config_clone.sample_format() {
            SampleFormat::F32 => create_local_stream!(
                device,
                config_clone,
                samples_for_thread,
                f32,
                app_for_thread,
                last_emit_for_thread,
                is_active_for_thread,
                stop_tx
            ),
            SampleFormat::I16 => create_local_stream!(
                device,
                config_clone,
                samples_for_thread,
                i16,
                app_for_thread,
                last_emit_for_thread,
                is_active_for_thread,
                stop_tx
            ),
            SampleFormat::U16 => create_local_stream!(
                device,
                config_clone,
                samples_for_thread,
                u16,
                app_for_thread,
                last_emit_for_thread,
                is_active_for_thread,
                stop_tx
            ),
            sample_format => {
                eprintln!("Unsupported sample format: {:?}", sample_format);
                return;
            }
        };

        let stream = match stream_result {
            Ok(s) => s,
            Err(e) => {
                eprintln!("Failed to create local stream: {}", e);
                return;
            }
        };

        stream.play().unwrap();
        println!("Local audio stream started");

        // Wait for stop signal
        let _ = stop_rx.recv();

        drop(stream);
        println!("Local audio stream stopped");
    });

    Ok((sample_rate, channels, stop_tx))
}



// ============================================================================
// Local Transcriber (Whisper-based)
// ============================================================================

/// Local transcriber using Whisper for offline transcription
pub struct LocalTranscriber {
    /// Audio sample buffer (shared with audio capture)
    samples: Arc<std::sync::Mutex<Vec<f32>>>,
    /// Chunk processor for background transcription
    chunk_processor: Option<Arc<ChunkProcessor>>,
    /// Thread handle for chunk monitor
    chunk_monitor_handle: Option<thread::JoinHandle<()>>,
    /// Thread handle for chunk worker
    chunk_worker_handle: Option<thread::JoinHandle<()>>,
    /// Channel to stop audio stream
    local_stop_tx: Option<crossbeam_channel::Sender<()>>,
    /// Sample rate of input audio
    sample_rate: u32,
    /// Number of channels in input audio
    channels: u16,
}

impl LocalTranscriber {
    /// Create a new LocalTranscriber
    pub fn new() -> Self {
        Self {
            samples: Arc::new(std::sync::Mutex::new(Vec::new())),
            chunk_processor: None,
            chunk_monitor_handle: None,
            chunk_worker_handle: None,
            local_stop_tx: None,
            sample_rate: 16000,
            channels: 1,
        }
    }

    /// Start local microphone transcription
    pub async fn start(
        &mut self,
        app: AppHandle,
        settings: TranscriptionSettings,
        is_active: Arc<AtomicBool>,
    ) -> Result<()> {
        // Clear previous samples
        if let Ok(mut samples) = self.samples.lock() {
            samples.clear();
        }

        // Start microphone capture
        let (sample_rate, channels, stop_tx) =
            start_local_microphone(app.clone(), is_active.clone(), self.samples.clone())?;

        self.sample_rate = sample_rate;
        self.channels = channels;
        self.local_stop_tx = Some(stop_tx);

        // Get Whisper model path
        let app_data_dir = app
            .path()
            .app_data_dir()
            .map_err(|e| anyhow::anyhow!("Failed to get app data directory: {}", e))?;

        let model_path = app_data_dir.join("stt").join("ggml-small-q8_0.bin");

        // Create chunk processor
        let chunk_processor = Arc::new(ChunkProcessor::new(
            self.samples.clone(),
            model_path,
            settings.auto_detect_language,
            settings.languages.clone(),
            settings.keyterms.clone(),
            sample_rate,
            channels,
        ));

        // Spawn background processing threads
        let monitor_handle = chunk_processor.spawn_chunk_monitor();
        let worker_handle = chunk_processor.spawn_chunk_worker();

        self.chunk_processor = Some(chunk_processor);
        self.chunk_monitor_handle = Some(monitor_handle);
        self.chunk_worker_handle = Some(worker_handle);

        println!(
            "Local transcription started with chunked processing (chunk: {}s)",
            CHUNK_DURATION_SECS
        );

        Ok(())
    }

    /// Stop local transcription and return merged results
    pub async fn stop(&mut self) -> Result<String> {
        // Stop audio capture
        if let Some(stop_tx) = self.local_stop_tx.take() {
            let _ = stop_tx.send(());
            println!("Sent stop signal to audio stream");
        }

        // Get the chunk processor
        let chunk_processor = self
            .chunk_processor
            .take()
            .ok_or_else(|| anyhow::anyhow!("No chunk processor"))?;

        // Process any remaining audio as final chunk BEFORE signaling stop
        // This ensures the final chunk is in the queue before the worker exits
        chunk_processor.process_final_chunk();

        // Now signal the processor to stop creating new chunks
        chunk_processor.signal_stop();

        // Take thread handles
        let monitor_handle = self.chunk_monitor_handle.take();
        let worker_handle = self.chunk_worker_handle.take();

        // Wait for all chunks to be processed (run in blocking task)
        let timeout = Duration::from_secs(300); // 5 minute timeout
        let chunk_processor_clone = chunk_processor.clone();
        let completed =
            tokio::task::spawn_blocking(move || chunk_processor_clone.wait_for_completion(timeout))
                .await
                .map_err(|e| anyhow::anyhow!("Failed to wait for completion: {}", e))?;

        if !completed {
            return Err(anyhow::anyhow!("Chunk processing timed out"));
        }

        // Join the threads (run in blocking task)
        tokio::task::spawn_blocking(move || {
            if let Some(handle) = monitor_handle {
                let _ = handle.join();
            }
            if let Some(handle) = worker_handle {
                let _ = handle.join();
            }
        })
        .await
        .map_err(|e| anyhow::anyhow!("Failed to join threads: {}", e))?;

        // Merge all chunk transcriptions
        let transcription = chunk_processor.merge_results();

        println!(
            "Whisper chunked transcription complete: '{}'",
            if transcription.len() > 100 {
                format!("{}...", &transcription[..100])
            } else {
                transcription.clone()
            }
        );

        Ok(transcription)
    }
}


// ============================================================================
// Helper Functions
// ============================================================================

/// Emit paste-complete event to the widget window
fn emit_paste_complete(app: &AppHandle) {
    if let Some(widget_window) = app.get_webview_window("widget") {
        let _ = widget_window.emit("paste-complete", ());
    }
}

// ============================================================================
// Transcription Service (Orchestration Layer)
// ============================================================================

pub struct TranscriptionService {
    is_recording: bool,
    is_active: Arc<AtomicBool>,
    auto_detect_language: bool,
    languages: Vec<String>,
    use_cloud: bool,
    // Active transcriber
    transcriber: Option<LocalTranscriber>,
}

impl TranscriptionService {
    pub fn new() -> Self {
        Self {
            is_recording: false,
            is_active: Arc::new(AtomicBool::new(false)),
            auto_detect_language: false,
            languages: vec!["en-US".to_string()],
            use_cloud: false,
            transcriber: None,
        }
    }

    pub fn is_recording(&self) -> bool {
        self.is_recording
    }

    pub async fn start_recording(
        &mut self,
        app: AppHandle,
        settings: TranscriptionSettings,
    ) -> Result<()> {
        if self.is_recording {
            return Err(anyhow::anyhow!("Already recording"));
        }

        // Set active flag to true
        self.is_active.store(true, Ordering::Relaxed);
        self.auto_detect_language = settings.auto_detect_language;
        self.languages = settings.languages.clone();
        self.use_cloud = settings.use_cloud;

        // Create local transcriber
        let mut transcriber = LocalTranscriber::new();

        // Start transcription
        transcriber
            .start(app.clone(), settings, self.is_active.clone())
            .await?;

        // Store transcriber and mark as recording
        self.transcriber = Some(transcriber);
        self.is_recording = true;

        Ok(())
    }

    pub fn stop_recording(
        &mut self,
        app: AppHandle,
        app_name: String,
        style: String,
    ) -> Result<()> {
        if !self.is_recording {
            return Err(anyhow::anyhow!("Not recording"));
        }

        // Set active flag to false to stop audio processing
        self.is_active.store(false, Ordering::Relaxed);
        self.is_recording = false;

        // Emit processing event
        let _ = app.emit("transcription-processing", ());

        // Take transcriber
        let mut transcriber = self
            .transcriber
            .take()
            .ok_or_else(|| anyhow::anyhow!("No active transcriber"))?;

        // Get app for async task
        let app_clone = app.clone();
        let use_cloud = self.use_cloud;

        // Spawn async task to stop transcription and process results
        tokio::spawn(async move {
            // Stop transcription and get raw text
            let transcription = match transcriber.stop().await {
                Ok(text) => text,
                Err(e) => {
                    eprintln!("Transcription failed: {}", e);
                    let _ = app_clone.emit("transcription-error", format!("{}", e));
                    emit_paste_complete(&app_clone);
                    return;
                }
            };

            if transcription.trim().is_empty() {
                println!("No transcription produced");
                emit_paste_complete(&app_clone);
                return;
            }

            // Apply formatting if cloud is enabled and auth token is available
            let (raw_text, final_text) =
                if use_cloud && !app_name.is_empty() && !style.is_empty() {
                    // Read auth token from Tauri store
                    let auth_token: Option<String> = app_clone
                        .store("auth.json")
                        .ok()
                        .and_then(|s| s.get("token"))
                        .and_then(|v| v.as_str().map(|s| s.to_string()));

                    println!("{:?}", auth_token);

                    if let Some(ref token) = auth_token {
                        println!("Formatting for category: {}, style: {}", app_name, style);
                        // app_name here is actually the category (Personal, Work, Email, General)
                        // passed from the frontend after detecting the active app
                        match format_text(token, &app_name, &style, &app_name, &transcription).await
                        {
                            Ok(formatted) => {
                                println!("Formatted: {}", formatted);
                                (transcription.clone(), formatted)
                            }
                            Err(e) => {
                                eprintln!("Failed to format: {}", e);
                                (transcription.clone(), transcription.clone())
                            }
                        }
                    } else {
                        println!("No auth token, skipping formatting");
                        (transcription.clone(), transcription.clone())
                    }
                } else {
                    (transcription.clone(), transcription.clone())
                };

            // Save transcription to database
            if let Err(e) = save_transcription_to_db(&app_clone, &raw_text, Some(&final_text)) {
                eprintln!("Failed to save transcription: {}", e);
            }

            // Paste the result
            paste_text(app_clone, final_text);
        });

        Ok(())
    }
}

fn paste_text(app: AppHandle, text: String) {
    #[cfg(target_os = "macos")]
    {
        use cocoa::base::{id, nil};
        use cocoa::foundation::NSString;
        use core_graphics::event::{CGEvent, CGEventFlags, CGEventTapLocation};
        use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};
        use objc::{class, msg_send, sel, sel_impl};

        // Clone app handle and text for the thread
        let app_clone = app.clone();
        let text_clone = text.clone();

        thread::spawn(move || {
            unsafe {
                let pasteboard: id = msg_send![class!(NSPasteboard), generalPasteboard];
                if pasteboard == nil {
                    eprintln!("Failed to get pasteboard");
                    if let Some(widget_window) = app_clone.get_webview_window("widget") {
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
                    if let Some(widget_window) = app_clone.get_webview_window("widget") {
                        let _ = widget_window.emit("paste-complete", ());
                    }
                    return;
                }

                let ns_string_type = NSString::alloc(nil).init_str("public.utf8-plain-text");
                let success: bool =
                    msg_send![pasteboard, setString:ns_string forType:ns_string_type];

                if !success {
                    eprintln!("Failed to set string to pasteboard");
                    if let Some(widget_window) = app_clone.get_webview_window("widget") {
                        let _ = widget_window.emit("paste-complete", ());
                    }
                    return;
                }

                // Small delay before sending keyboard events
                thread::sleep(Duration::from_millis(50));

                // Send Cmd+V keyboard events
                if let Ok(event_source) = CGEventSource::new(CGEventSourceStateID::HIDSystemState) {
                    if let Ok(key_down) = CGEvent::new_keyboard_event(event_source.clone(), 9, true)
                    {
                        key_down.set_flags(CGEventFlags::CGEventFlagCommand);
                        let _ = key_down.post(CGEventTapLocation::HID);
                    }

                    thread::sleep(Duration::from_millis(50));

                    if let Ok(key_up) = CGEvent::new_keyboard_event(event_source, 9, false) {
                        key_up.set_flags(CGEventFlags::CGEventFlagCommand);
                        let _ = key_up.post(CGEventTapLocation::HID);
                    }
                }

                // Wait a bit for paste to complete
                thread::sleep(Duration::from_millis(100));

                // Clear clipboard after pasting (don't restore old contents to avoid exceptions)
                let _: () = msg_send![pasteboard, clearContents];

                println!("✅ Pasted successfully.");
            }

            // Always emit paste-complete event
            if let Some(widget_window) = app_clone.get_webview_window("widget") {
                let _ = widget_window.emit("paste-complete", ());
            }
        });
    }

    #[cfg(not(target_os = "macos"))]
    {
        eprintln!("Paste functionality is only available on macOS");
        if let Some(widget_window) = app.get_webview_window("widget") {
            let _ = widget_window.emit("paste-complete", ());
        }
    }
}

/// Simple linear resampling
fn resample_audio(samples: &[f32], from_rate: u32, to_rate: u32) -> Vec<f32> {
    if from_rate == to_rate {
        return samples.to_vec();
    }

    let ratio = from_rate as f64 / to_rate as f64;
    let new_len = (samples.len() as f64 / ratio) as usize;
    let mut resampled = Vec::with_capacity(new_len);

    for i in 0..new_len {
        let src_idx = i as f64 * ratio;
        let idx = src_idx as usize;
        let frac = src_idx - idx as f64;

        let sample = if idx + 1 < samples.len() {
            samples[idx] * (1.0 - frac as f32) + samples[idx + 1] * frac as f32
        } else if idx < samples.len() {
            samples[idx]
        } else {
            0.0
        };

        resampled.push(sample);
    }

    resampled
}

pub type TranscriptionServiceHandle = Arc<Mutex<TranscriptionService>>;

pub fn create_transcription_service() -> TranscriptionServiceHandle {
    Arc::new(Mutex::new(TranscriptionService::new()))
}

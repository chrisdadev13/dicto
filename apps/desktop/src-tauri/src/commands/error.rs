use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct CommandError {
    pub code: ErrorCode,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub enum ErrorCode {
    DatabaseError,
    NotFound,
    ValidationError,
    DuplicateEntry,
    InvalidInput,
}

impl CommandError {
    pub fn database(message: impl Into<String>) -> Self {
        Self {
            code: ErrorCode::DatabaseError,
            message: message.into(),
        }
    }

    pub fn not_found(entity: &str, id: &str) -> Self {
        Self {
            code: ErrorCode::NotFound,
            message: format!("{} with id '{}' not found", entity, id),
        }
    }

    pub fn validation(message: impl Into<String>) -> Self {
        Self {
            code: ErrorCode::ValidationError,
            message: message.into(),
        }
    }

    pub fn duplicate(entity: &str, field: &str, value: &str) -> Self {
        Self {
            code: ErrorCode::DuplicateEntry,
            message: format!("{} with {} '{}' already exists", entity, field, value),
        }
    }

    pub fn invalid_input(message: impl Into<String>) -> Self {
        Self {
            code: ErrorCode::InvalidInput,
            message: message.into(),
        }
    }
}

impl From<rusqlite::Error> for CommandError {
    fn from(err: rusqlite::Error) -> Self {
        Self::database(err.to_string())
    }
}

impl From<r2d2::Error> for CommandError {
    fn from(err: r2d2::Error) -> Self {
        Self::database(err.to_string())
    }
}

impl From<String> for CommandError {
    fn from(err: String) -> Self {
        Self::database(err)
    }
}

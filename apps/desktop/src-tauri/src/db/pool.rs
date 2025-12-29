use r2d2::{Pool, PooledConnection};
use r2d2_sqlite::SqliteConnectionManager;
use std::path::PathBuf;
use std::sync::OnceLock;

pub type DbPool = Pool<SqliteConnectionManager>;
pub type DbConnection = PooledConnection<SqliteConnectionManager>;

static DB_POOL: OnceLock<DbPool> = OnceLock::new();

/// Initialize the database connection pool
pub fn init_pool(db_path: PathBuf) -> Result<(), String> {
    let manager = SqliteConnectionManager::file(&db_path);

    let pool = Pool::builder()
        .max_size(10)
        .min_idle(Some(2))
        .build(manager)
        .map_err(|e| format!("Failed to create connection pool: {}", e))?;

    // Enable WAL mode and foreign keys on a test connection
    {
        let conn = pool
            .get()
            .map_err(|e| format!("Failed to get initial connection: {}", e))?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
            .map_err(|e| format!("Failed to set pragmas: {}", e))?;
    }

    DB_POOL
        .set(pool)
        .map_err(|_| "Pool already initialized".to_string())
}

/// Get a connection from the pool
pub fn get_connection() -> Result<DbConnection, String> {
    DB_POOL
        .get()
        .ok_or_else(|| "Database pool not initialized".to_string())?
        .get()
        .map_err(|e| format!("Failed to get database connection: {}", e))
}

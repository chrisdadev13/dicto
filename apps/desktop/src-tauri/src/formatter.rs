use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json;

const API_URL: &str = "https://dicto-ai-server.vercel.app/llm/formatting";

#[derive(Serialize)]
struct FormatRequest {
    category: String,
    style: String,
    #[serde(rename = "appName")]
    app_name: String,
    text: String,
}

#[derive(Deserialize)]
struct FormatResponse {
    #[serde(rename = "formattedText")]
    formatted_text: String,
}

/// Format text by calling the server API
pub async fn format_text(
    auth_token: &str,
    category: &str,
    style: &str,
    app_name: &str,
    text: &str,
) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    let client = Client::new();

    let request_body = FormatRequest {
        category: category.to_string(),
        style: style.to_string(),
        app_name: app_name.to_string(),
        text: text.to_string(),
    };

    println!("Sending format request: category={}, style={}, app_name={}", category, style, app_name);

    let response = match client
        .post(API_URL)
        .header("Authorization", format!("Bearer {}", auth_token))
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
    {
        Ok(resp) => resp,
        Err(e) => {
            eprintln!("Failed to send request: {:?}", e);
            return Err(format!("Request failed: {}", e).into());
        }
    };

    println!("Response status: {}", response.status());

    if response.status() == 401 {
        return Err("Unauthorized - please sign in".into());
    }

    let response_text = response.text().await?;
    println!("Response body: {}", response_text);

    let result: FormatResponse = serde_json::from_str(&response_text)?;
    Ok(result.formatted_text)
}

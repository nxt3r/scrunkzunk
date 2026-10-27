use serde::Serialize;

#[derive(Serialize, Clone, Copy, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SafetyTier {
    Safe,
    Review,
    Blocked,
}

pub fn classify_path(path: &str) -> Option<(SafetyTier, String)> {
    let lower = path.to_lowercase();

    if lower.ends_with("\\target") || lower.contains("\\target\\") {
        return Some((SafetyTier::Safe, "Rust build target".to_string()));
    }
    if lower.ends_with("\\__pycache__") || lower.contains("\\__pycache__\\") {
        return Some((SafetyTier::Safe, "Python bytecode cache".to_string()));
    }
    if lower.ends_with("\\.next\\cache") || lower.contains("\\.next\\cache\\") {
        return Some((SafetyTier::Safe, "Next.js build cache".to_string()));
    }
    if lower.ends_with("\\dist") || lower.contains("\\dist\\") {
        return Some((SafetyTier::Safe, "Build output".to_string()));
    }

    if lower.ends_with("\\node_modules") || lower.contains("\\node_modules\\") {
        return Some((SafetyTier::Review, "Dependencies".to_string()));
    }
    if lower.ends_with("\\.venv") || lower.contains("\\.venv\\") {
        return Some((SafetyTier::Review, "Python virtual environment".to_string()));
    }
    
    if lower.ends_with("\\.git") || lower.contains("\\.git\\") {
        return Some((SafetyTier::Blocked, "Git data".to_string()));
    }
    if lower.ends_with("\\package.json") || lower.ends_with("\\cargo.toml") {
        return Some((SafetyTier::Blocked, "Project config".to_string()));
    }

    None
}
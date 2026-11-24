//! The generated files, read once at start: body, gzip representation, media type and strong
//! validator of each (port of `loadSite` and its helpers in `server/http.ts`).

use std::collections::HashMap;
use std::io::Write;
use std::path::Path;

use flate2::Compression;
use flate2::write::GzEncoder;
use sha2::{Digest, Sha256};

use crate::tokens::hex;
use crate::web::{decode_uri_component, js_trim};

pub struct StaticFile {
    pub body: Vec<u8>,
    pub gzip: Option<Vec<u8>>,
    pub media_type: &'static str,
    /// Strong validator: the SHA-256 of the body, quoted.
    pub etag: String,
}

pub type Site = HashMap<String, StaticFile>;

pub const HTML: &str = "text/html; charset=utf-8";

fn media_type(extension: &str) -> &'static str {
    match extension {
        ".html" => HTML,
        ".css" => "text/css; charset=utf-8",
        ".js" => "text/javascript; charset=utf-8",
        ".svg" => "image/svg+xml",
        ".woff2" => "font/woff2",
        ".xml" => "application/xml; charset=utf-8",
        ".txt" => "text/plain; charset=utf-8",
        ".json" => "application/json",
        _ => "application/octet-stream",
    }
}

/// `path.extname` of Node: the last dot of the last segment, unless it only leads the name.
fn extname(path: &str) -> &str {
    let base = path.rsplit('/').next().unwrap_or(path);
    let Some(first_named) = base.find(|character| character != '.') else {
        return "";
    };
    match base.rfind('.') {
        Some(dot) if dot > first_named => base.get(dot..).unwrap_or(""),
        _ => "",
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SiteError {
    Unreadable,
    WithoutIndex,
}

impl SiteError {
    pub fn code(self) -> &'static str {
        match self {
            Self::Unreadable => "server.site_unreadable",
            Self::WithoutIndex => "server.site_without_index",
        }
    }
}

fn gzip(body: &[u8]) -> Result<Vec<u8>, SiteError> {
    let mut encoder = GzEncoder::new(Vec::new(), Compression::best());
    encoder.write_all(body).map_err(|_| SiteError::Unreadable)?;
    encoder.finish().map_err(|_| SiteError::Unreadable)
}

fn walk(directory: &Path, prefix: &str, site: &mut Site) -> Result<(), SiteError> {
    for entry in std::fs::read_dir(directory).map_err(|_| SiteError::Unreadable)? {
        let entry = entry.map_err(|_| SiteError::Unreadable)?;
        let name = entry
            .file_name()
            .into_string()
            .map_err(|_| SiteError::Unreadable)?;
        // Symbolic links are neither files nor directories here, as for `Dirent` of Node.
        let kind = entry.file_type().map_err(|_| SiteError::Unreadable)?;
        let path = format!("{prefix}/{name}");
        if kind.is_dir() {
            walk(&entry.path(), &path, site)?;
        } else if kind.is_file() {
            let body = std::fs::read(entry.path()).map_err(|_| SiteError::Unreadable)?;
            let extension = extname(&path);
            // Already compressed formats gain nothing from gzip.
            let gzip = if extension == ".woff2" {
                None
            } else {
                Some(gzip(&body)?)
            };
            let etag = format!("\"{}\"", hex(&Sha256::digest(&body)));
            let media_type = media_type(extension);
            site.insert(
                path,
                StaticFile {
                    body,
                    gzip,
                    media_type,
                    etag,
                },
            );
        }
    }
    Ok(())
}

pub fn load_site(directory: &Path) -> Result<Site, SiteError> {
    let mut site = Site::new();
    walk(directory, "", &mut site)?;
    if !site.contains_key("/index.html") {
        return Err(SiteError::WithoutIndex);
    }
    Ok(site)
}

/// The file path of a URL path, or `None` when it is malformed or leaves the site.
pub fn resolve_path(pathname: &str) -> Option<String> {
    let decoded = decode_uri_component(pathname)?;
    if decoded.contains(['\0', '\\']) || decoded.split('/').any(|segment| segment == "..") {
        return None;
    }
    Some(if decoded.ends_with('/') {
        format!("{decoded}index.html")
    } else {
        decoded
    })
}

/// If-None-Match is a list compared weakly, or `*` (RFC 9110 §13.1.2).
pub fn none_match_hits(header: Option<&str>, etag: &str) -> bool {
    let Some(header) = header else {
        return false;
    };
    if js_trim(header) == "*" {
        return true;
    }
    header.split(',').any(|entry| {
        let entry = js_trim(entry);
        entry.strip_prefix("W/").unwrap_or(entry) == etag
    })
}

#[cfg(test)]
#[allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::panic,
    clippy::indexing_slicing
)]
mod tests {
    use super::*;

    #[test]
    fn reads_extensions_like_node() {
        assert_eq!(extname("/a/b.css"), ".css");
        assert_eq!(extname("/a/.index.md"), ".md");
        assert_eq!(extname("/a/.gitignore"), "");
        assert_eq!(extname("/a/index."), ".");
        assert_eq!(extname("/a/plain"), "");
    }

    #[test]
    fn resolves_paths_and_refuses_escapes() {
        assert_eq!(resolve_path("/").as_deref(), Some("/index.html"));
        assert_eq!(resolve_path("/a%20b/").as_deref(), Some("/a b/index.html"));
        for path in ["/..%2f..%2fetc/passwd", "/a%5Cb", "/%00", "/%E0%A4%A"] {
            assert_eq!(resolve_path(path), None, "{path}");
        }
    }

    #[test]
    fn compares_validators_weakly() {
        let etag = "\"abc\"";
        assert!(none_match_hits(Some("W/\"abc\""), etag));
        assert!(none_match_hits(Some("\"0\", \"abc\""), etag));
        assert!(none_match_hits(Some(" * "), etag));
        assert!(!none_match_hits(Some("\"0\""), etag));
        assert!(!none_match_hits(None, etag));
    }
}

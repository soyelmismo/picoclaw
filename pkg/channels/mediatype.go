package channels

import (
	"path/filepath"
	"strings"
)

// ClassifyMediaType maps a filename and content type to a media kind string:
// "image", "audio", "video", or "file".
// Content type is checked first (MIME prefix), then file extension as fallback.
func ClassifyMediaType(filename, contentType string) string {
	ct := strings.ToLower(strings.TrimSpace(contentType))
	switch {
	case strings.HasPrefix(ct, "image/"):
		return "image"
	case strings.HasPrefix(ct, "audio/"), ct == "application/ogg", ct == "application/x-ogg":
		return "audio"
	case strings.HasPrefix(ct, "video/"):
		return "video"
	}

	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg":
		return "image"
	case ".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac", ".wma", ".opus", ".silk":
		return "audio"
	case ".mp4", ".avi", ".mov", ".webm", ".mkv":
		return "video"
	}

	return "file"
}

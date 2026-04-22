# .aem File Format Specification

**AEM** = **A**udio **E**vents **M**IDI

Version: **1**

## Overview

The `.aem` format is a self-contained binary file that packages a single song's audio data together with all its associated settings (markers, volume, playback speed, A/B loop points). It is designed for robust export/import within the Audio Events MIDI PWA, with zero external library dependencies.

## Design Goals

- **Single-file portability** — one `.aem` file = one complete song with all settings
- **No size bloat** — audio is stored as raw bytes (no Base64 encoding)
- **Simple parsing** — uses `DataView` + `TextEncoder`/`TextDecoder` (built-in browser APIs)
- **Forward-compatible** — version byte allows future format evolution

## Binary Layout

```
Offset   Size       Field              Description
──────   ─────────  ─────────────────  ────────────────────────────────────────
0        4 bytes    Magic              ASCII "AEMI" (0x41 0x45 0x4D 0x49)
4        1 byte     Format Version     Currently 1
5        4 bytes    Metadata Length    Uint32, big-endian — byte length of the JSON metadata block
9        N bytes    JSON Metadata      UTF-8 encoded JSON (structure below)
9+N      remaining  Audio Data         Raw audio blob (MP3, WAV, OGG, etc.)
```

### Total file size

`9 + (metadata JSON byte length) + (audio blob byte length)`

## Magic Bytes

The first 4 bytes are always `AEMI` (hex: `41 45 4D 49`). This identifies the file as an Audio Events MIDI export and allows quick validation before attempting to parse.

## Format Version

A single byte at offset 4. The current (and only) version is `1`. Future versions may extend the metadata schema or the binary layout. Importers should reject files with a version higher than they support.

## JSON Metadata Schema (v1)

The metadata block is a UTF-8 JSON object with the following fields:

```json
{
  "version": 1,
  "name": "My Song.mp3",
  "type": "audio/mpeg",
  "lastModified": 1713400000000,
  "markerData": {
    "activeId": "default",
    "sets": {
      "default": {
        "name": "Default Set",
        "events": [
          { "time": 12.5, "preset": 1 },
          { "time": 24.3, "preset": 5 },
          { "time": 45.1, "preset": 12 }
        ]
      }
    }
  },
  "volume": 0.85,
  "speed": 1.25,
  "abLoop": {
    "enabled": true,
    "visible": true,
    "a": 12.5,
    "b": 45.1
  }
}
```

### Field Reference

| Field            | Type           | Required | Default | Description |
|------------------|----------------|----------|---------|-------------|
| `version`        | number         | yes      | —       | Schema version (must be `1`) |
| `name`           | string         | yes      | —       | Original song filename (used as display name and IDB key) |
| `type`           | string         | yes      | `""`    | MIME type of the audio (e.g. `"audio/mpeg"`, `"audio/wav"`) |
| `lastModified`   | number         | no       | now     | Unix timestamp (ms) of the original file |
| `markers`        | array          | no       | `[]`    | Array of marker objects |
| `markers[].time` | number         | yes      | —       | Marker position in seconds (e.g. `12.5`) |
| `markers[].preset` | number       | yes      | —       | MIDI preset number (1–100). 1–50 = P01–P50, 51–100 = F01–F50 |
| `volume`         | number         | no       | `1.0`   | Playback volume (0.0–1.0) |
| `speed`          | number         | no       | `1.0`   | Playback speed (e.g. `0.8`, `1.0`, `1.5`) |
| `abLoop`         | object \| null | no       | `null`  | A/B loop settings, or null if none |
| `abLoop.enabled` | boolean        | —        | `false` | Whether A/B looping is active |
| `abLoop.visible` | boolean        | —        | `true`  | Whether A/B overlay is shown on the progress bar |
| `abLoop.a`       | number \| null | —        | `null`  | Loop start time in seconds |
| `abLoop.b`       | number \| null | —        | `null`  | Loop end time in seconds |

## Audio Data

Everything after `9 + metadata_length` bytes is the raw audio blob. The MIME type in the metadata tells the importer how to reconstruct the `Blob`/`File` object. No encoding or compression is applied — the audio bytes are stored as-is from the original file.

## Export Flow

1. Fetch the song record from IndexedDB (contains the audio `File` object)
2. Gather all per-song metadata from localStorage (markers, volume, speed, A/B loop)
3. Serialize metadata to JSON, encode as UTF-8
4. Build the binary layout: magic + version + length + JSON + audio bytes
5. Save using the File System Access API (`showSaveFilePicker`) if available, otherwise fall back to `<a download>` to the device's Downloads folder

### File System Access API

When supported (Chrome/Edge on Android and desktop), the user gets a native "Save As" dialog to choose the destination folder. The app remembers the last-used directory handle (`lastExportDirHandle`) for convenience on subsequent exports.

When not supported (Safari, Firefox), the file downloads to the browser's default Downloads folder.

## Import Flow

1. User selects a `.aem` file via file picker
2. Validate magic bytes (`AEMI`)
3. Check format version (reject if > supported version)
4. Parse metadata length, extract and decode JSON metadata
5. Extract remaining bytes as the audio blob
6. Check for name collisions in the existing playlist:
   - If duplicate: prompt the user for a new name (pre-filled with auto-generated unique name)
   - User can accept, modify, or cancel
7. Store the audio as a `File` object in IndexedDB
8. Write markers, volume, speed, and A/B loop data to localStorage under the (possibly renamed) song key
9. Re-render the playlist (song appears at the end)

## Security Considerations

- Magic byte validation prevents accidental import of non-`.aem` files
- Metadata length is bounds-checked against the actual file size to prevent buffer overflows
- JSON parsing is wrapped in try/catch to handle corrupt metadata
- Song names are sanitized during export for filesystem safety
- The audio blob is never executed — it's only used as `src` for an `<audio>` element via `URL.createObjectURL`

## Example

A song "Blues Jam.mp3" (5 MB) with 3 markers, volume at 80%, speed 0.9x, and an A/B loop:

```
File size: ~5,000,300 bytes
├─ Bytes 0–3:      41 45 4D 49                          ("AEMI")
├─ Byte 4:         01                                   (version 1)
├─ Bytes 5–8:      00 00 01 1A                          (282 = metadata JSON length)
├─ Bytes 9–290:    {"version":1,"name":"Blues Jam..."}   (UTF-8 JSON)
└─ Bytes 291–end:  [raw MP3 audio bytes]                 (~5,000,000 bytes)
```

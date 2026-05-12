# Share Design and Behavior

## Purpose
This document describes how song and playset sharing works in Audio Events MIDI and what limitations to expect on Android and Windows.

## File Formats
Local export/import formats are native:
- Songs: `.aem`
- Playsets: `.aeps`

External share transport formats are wrapper files for compatibility:
- Songs shared as `<song>.aem.txt` with MIME `text/plain`
- Playsets shared as `<playset>.aeps.txt` with MIME `text/plain`

The payloads are still native content:
- Song share payload is the same packed AEM bytes
- Playset share payload is the same JSON structure used for `.aeps`

## Architecture

### Core share gateway
- `tryNativeShareFile(file, options)` is the only Web Share API entry point.
- It returns one of:
  - `shared`
  - `cancelled` (`AbortError`)
  - `unsupported`
  - `error`

### Share entrypoints
- `shareSongByName(songName)`
  - builds AEM payload via `packAem(songName)`
  - wraps in `<name>.aem.txt` (`text/plain`)
  - calls `tryNativeShareFile`
- `sharePlaysetById(playsetId)`
  - builds playset payload from current model
  - wraps in `<name>.aeps.txt` (`text/plain`)
  - calls `tryNativeShareFile`

### Export entrypoints (local only)
- `exportSong(songName, options)` writes `.aem`
- `exportPlaysetById(playsetId, options)` writes `.aeps`

Export code and share code are intentionally separated.

## Shared-Target Import
Incoming shared files are processed through:
- `importSharedFilesFromShareTarget()`
- `detectSharedImportKind(file)`

Classification order:
1. Extension hints (`.aem`, `.aep`, `.aeps`)
2. AEM magic header check (`AEMI`) for song
3. JSON shape check (`name` string and `songNames` array) for playset
4. Fallback to `unknown`

This allows `.aem.txt` and `.aeps.txt` to import correctly even if an app rewrites extension or MIME.

## Platform notes and limitations

### Share vs Open with
- Share flow (`navigator.share`) and Open with flow are different OS features.
- This app integrates with Share flow using PWA `share_target`.
- Open with may not route files to the app on many devices/browsers.

### Android
- Some apps modify filename extension and MIME while forwarding attachments.
- Content-based detection is used so imports still work after such rewrites.
- If the browser/PWA does not support file share via Web Share API, sharing will report `unsupported`.

### Windows
- Desktop browsers can support file sharing in some contexts, but behavior varies by browser and install mode.
- Native local export/import remains the reliable baseline.

## UX behavior
- Canceling the native share sheet is not treated as an error.
- Unsupported share capability shows a clear unsupported message.
- Import from share target shows a summary notice with imported/unsupported/failed counts.

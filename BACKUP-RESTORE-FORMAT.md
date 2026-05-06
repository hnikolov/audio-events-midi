# Backup and Restore Format Specification

Version: 1 (draft)

## Overview

This document defines the multi-song backup and restore contract for Audio Events MIDI.

- Single-song export/import remains the `.aem` format described in `AEM-FORMAT.md`.
- Backup/restore uses a manifest plus metadata snapshot and optional song `.aem` files.

## Design Goals

- Reuse existing song import/export and playset import logic.
- Keep restore deterministic and user-auditable.
- Keep implementation small and maintainable.

## Files in Backup Folder

- `backup-manifest.json` (required)
- `metadata-latest.json` (required)
- `songs/*.aem` (required for modes that include audio)

## backup-manifest.json (v1)

```json
{
  "manifestVersion": 1,
  "appId": "audio-events-midi",
  "createdAt": "2026-05-06T10:00:00.000Z",
  "updatedAt": "2026-05-06T10:02:30.000Z",
  "backupMode": "hybrid",
  "generator": {
    "name": "Audio Events MIDI",
    "appVersion": "1.2.12",
    "schemaRevision": "backup-v1"
  },
  "stateDigest": {
    "playlistOrderRevision": 42,
    "playsetRevision": 17,
    "settingsRevision": 8,
    "lastMutationAt": "2026-05-06T10:02:30.000Z"
  },
  "metadataSnapshot": {
    "file": "metadata-latest.json",
    "sha256": "abcdef...",
    "sizeBytes": 12345,
    "createdAt": "2026-05-06T10:02:30.000Z"
  },
  "songs": [
    {
      "songId": "song-1711234567000-gig-night",
      "displayName": "Gig Night.mp3",
      "normalizedName": "gig night.mp3",
      "audio": {
        "file": "songs/Gig Night.aem",
        "format": "aem",
        "aemVersion": 1,
        "sha256": "1234...",
        "sizeBytes": 5032192,
        "createdAt": "2026-05-06T10:01:10.000Z"
      },
      "metadata": {
        "file": null,
        "inline": {
          "markerData": { "activeId": "default", "sets": {} },
          "volume": 1,
          "speed": 1,
          "abLoop": { "enabled": false, "visible": true, "a": null, "b": null },
          "eq": { "bass": 0, "mid": 0, "treble": 0 },
          "updatedAt": "2026-05-06T10:01:10.000Z"
        }
      }
    }
  ]
}
```

## metadata-latest.json (v1)

```json
{
  "manifestVersion": 1,
  "exportedAt": "2026-05-06T10:02:30.000Z",
  "appVersion": "1.2.12",
  "playlistOrder": ["Gig Night.mp3"],
  "playsetState": {},
  "uiTheme": "dark",
  "uiSettings": {
    "playsetOneClickSelect": false,
    "markerSetOneClickSelect": false
  },
  "playMode": "none",
  "eventMap": {},
  "volumeMap": {},
  "speedMap": {},
  "abLoopMap": {},
  "eqMap": {}
}
```

## Validation Rules

- Reject manifest if `manifestVersion` is missing or greater than supported.
- Skip items whose referenced files are missing.
- Skip items whose hashes mismatch unless force-restore is explicitly enabled.
- Ignore unknown extra fields for forward compatibility.

## Shared Skipped-Song Reporting

The same missing-song reporting utility must be used by:

- Backup restore playset application
- Manual playset import (`.aeps.json`)

Behavior requirement:

- Same list format
- Same count semantics
- Same naming and wording style

## Restore Report Shape (v1)

```json
{
  "songsImported": 0,
  "songsOverwritten": 0,
  "songsRenamed": 0,
  "songsSkippedMissingFile": [],
  "songsSkippedHashMismatch": [],
  "songsSkippedUserChoice": [],
  "playsetsImported": 0,
  "playsetsOverwritten": 0,
  "playsetsRenamed": 0,
  "playsetsSkippedMissingSongs": [
    { "playsetName": "Gig Set", "missingSongNames": ["Song X.mp3"] }
  ],
  "settingsAppliedKeys": [],
  "settingsSkippedKeys": [],
  "warnings": []
}
```

## UI Constraint

Any new backup/restore menu or modal should reuse the existing top/bottom slide sheet styling already used in the app.

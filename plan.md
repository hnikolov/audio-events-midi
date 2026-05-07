# Audio Events MIDI - Backup and Restore Design (From Scratch)

Date: 2026-05-06

## 1. Scope and Assumptions

This design assumes only the following existing capabilities are available (to be verified when implementation starts):
1. Song export and import using .aem (single-song full state).
2. Playset export and import using existing playset payload format.
3. Persistent global app settings in local storage.

This document defines a complete feature design and implementation plan that is detailed but deliberately simple.

## 2. Product Goals

1. Make backup reliable enough to recover after app/site data clear.
2. Keep write activity small and predictable during normal use.
3. Ensure restore is understandable, deterministic, and safe.
4. Reuse existing song and playset export/import.
5. Avoid introducing heavy new infrastructure.

## 3. Design Principles

1. No redundant data: if data is already in .aem, do not duplicate it elsewhere.
2. Selective auto-backup: update only affected files.
3. Manual full backup only: expensive full exports happen only by explicit user action.
4. Folder stability: if backup folder is valid, never prompt again on enable.
5. Shared logic: manual playset import and restore playset import use the same core function.
6. Shared logic: manual full backup and full restore use the same export and import core functions (plus more).

## 4. Backup Data Model

Backup root folder contents:
1. songs folder:
	- one .aem file per song.
2. playsets folder:
	- one .aeps file per playset.
	- includes one special All songs playset for master order.
3. metadata-latest.json:
	- only global app-level settings not stored in song or playset files.

## 5. File Formats

### 5.1 Song backup files

1. Extension: .aem
2. Content source: existing song export function.
3. Contains audio + per-song state:
	- markers/marker sets
	- volume
	- speed
	- AB loop
	- EQ

### 5.2 Playset backup files

1. Extension: .aeps
2. Content source: existing playset export payload.
3. Shape:
	- version
	- name
	- isAllSongs boolean
	- songNames in desired playlist order
	- createdAt
	- updatedAt

All songs master order is represented as a normal playset file with:
1. name = All songs
2. isAllSongs = true
3. songNames in desired playlist order

### 5.3 Global metadata file

File: metadata-latest.json

Contains only:
1. version
2. exportedAt
3. appVersion
4. selectedListId
5. uiTheme
6. uiSettings
7. playMode

## 6. Trigger Model

### 6.1 Manual actions

1. Backup All:
	- rewrites all song .aem files
	- rewrites all playset .aeps files
	- rewrites metadata-latest.json
    Note: overwrites files with the same names if present in the target folder
2. Restore:
	- first, using the songs order from All songs playset, imports all songs (.aem files)
	- imports remaining playsets
	- applies metadata settings

### 6.2 Auto-backup actions (incremental only)

Auto-backup enabled means incremental writes only. No full rewrite.

Song-level changes update one song file:
1. marker add/edit/delete
2. marker set operations
3. volume change
4. speed change
5. AB loop change
6. EQ change
Note: update only the relevant meta data in the .aem file - do not write the audio blob in every auto update

Library membership changes:
1. song added:
	- write new song .aem
	- update All songs .aeps
2. song removed:
	- remove corresponding song .aem
	- update All songs .aeps
	- update impacted playset .aeps files
3. song renamed:
	- update field 'name' in old song backup file
	- rename old song backup file
	- update All songs .aeps
	- export/overwrite (backup) All songs .aeps
	- update impacted playset .aeps files
	- export/overwrite (backup) impacted playset .aeps files

Playset changes:
1. create playset: export (write) one .aeps
2. rename playset: 
	- remove old playset backup file (.aeps)
	- export new playset backup file (.aeps)
3. edit membership: (the same as rename playset)
	- remove old playset backup file (.aeps)
	- export new playset backup file (.aeps)
4. delete playset: remove one .aeps

Global settings changes:
1. theme, ui settings, play mode, selectedListId
2. rewrite metadata-latest.json only

Hard rule:
1. Auto-backup must never call Backup All.

## 7. Folder Handle and Permission Behavior

When user toggles auto-backup ON:
1. If cached folder handle exists and write permission is granted, enable immediately with no picker.
2. If handle exists and permission is not granted, request permission.
3. Show folder picker only if no valid writable handle exists.

When user taps Select folder:
1. Always show picker to explicitly replace current folder.

When auto-backup is OFF:
1. No automatic writes occur.
2. Manual Backup All remains available.

## 8. UI Design

UI placement:
1. Reuse existing info slide sheet.
2. Add compact Backup section with:
	- Auto-backup toggle
	- Select folder button
	- Backup all now button
	- Restore button
	- status line
    - reuse the same fixed 5-chip style and layout for the buttons as in the other slide menus, use spacers (e.g., 'markers' menu)

Status line content:
1. folder label
2. last successful backup time
3. last error if any

Interaction rules:
1. Disable action buttons while backup/restore job is running.
2. Keep confirmation prompts short and clear.
3. Use existing visual language and classes.

## 9. Restore Design

Input discovery (no manifest):
1. songs folder:
	- accept *.aem
2. playsets folder:
	- accept *.aeps
3. metadata-latest.json:
	- optional

Restore sequence:
1. First, using the songs order from All songs playset (.aeps). import the songs (.aem).
2. Then, import all other playsets
3. Apply metadata settings last.

Conflict policy:
1. Song name collisions:
	- reuse existing song import conflict flow.
2. Playset name collisions:
	- user chooses overwrite or import as renamed copy.
3. Missing songs referenced by playsets:
	- import playset with available songs only
	- report missing song names.

Partial restore tolerance:
1. If songs missing, still restore playsets/settings.
2. If playsets missing, still restore songs/settings.
3. If metadata missing, still restore songs/playsets.

## 10. Shared Core Functions

Keep code small by centralizing behavior:
1. writeSongBackup(songName, options)
2. writeAllSongsPlaysetBackup()
3. writePlaysetBackup(playsetId)
4. writeMetadataBackup()
5. backupAll()
6. applyPlaysetPayload(payload, options)
7. importSongFromFile(file, options)
8. createRestoreReport()
9. formatSkippedSongsMessage(...)

All playset imports (manual and restore) must call applyPlaysetPayload.

## 11. Performance and Safety

1. Debounce incremental writes by entity type.
2. Coalesce repeated updates to the same entity.
3. Use in-progress lock:
	- do not run backup while restore is running.
	- do not run overlapping backup jobs.
4. Use best-effort atomic writes per file:
	- write whole file content in one writable session.
5. Never block playback on backup errors.

## 12. Error Handling and Reporting

Backup errors:
1. update status line with last error.
2. keep app usable.

Restore report fields:
1. songsImported
2. songsSkippedMissingFile
3. songsSkippedUserChoice
4. playsetsImported
5. playsetsOverwritten
6. playsetsRenamed
7. playsetsSkippedMissingSongs with names
8. settingsAppliedKeys
9. warnings

Display strategy:
1. compact summary in alert/modal.
2. include top N names for skipped items.

## 13. Backward Compatibility

1. Existing .aem format remains unchanged.

## 14. Implementation Plan (Phased)

Phase 1 - Core file writers
1. Implement targeted backup writer functions.
2. Implement backupAll using those writers.

Phase 2 - Trigger wiring
1. Add targeted incremental triggers.
2. Add strict manual-only full backup path.

Phase 3 - Folder behavior
1. Implement enableAutoBackupWithoutReprompt logic.
2. Implement explicit Select folder replacement flow.

Phase 4 - Restore pipeline
1. Implement discovery-based restore.
2. Implement ordered restore: songs (with order from All songs playset), other playsets, settings.
3. Reuse shared song import and playset import cores.

Phase 5 - UI and reporting
1. Finalize info sheet controls and states.
2. Add restore report summary.

Phase 6 - Compatibility
1. Update docs and tests.

## 15. Validation Checklist

1. Enable auto-backup when folder already set:
	- no folder picker.
2. Change marker on one song:
	- only that song .aem updated.
3. Change speed, volume, EQ:
	- only current song .aem updated.
4. Add song:
	- one new .aem + updated All songs .aeps.
5. Remove song:
	- song .aem removed + impacted playset files updated.
6. Edit one playset:
	- only that .aeps updated.
7. Manual Backup All:
	- all songs and all playsets rewritten.
8. Restore with full dataset:
	- songs restored first, then All songs, then custom playsets, then settings.
9. Restore with missing folders/files:
	- partial restore still succeeds with warnings.
10. Legacy compatibility:
	- .aeps.json still importable.

## 16. Final Expected Outcome

1. Backup is robust but lightweight.
2. Auto-backup feels invisible and cheap.
3. Full backup happens only on explicit user action.
4. Restore is straightforward and reliable.
5. Codebase remains simple through reuse and clear separation of concerns.

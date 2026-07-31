# Auto Gain (Normalized Volume) - Implementation Guide

## Overview
This document describes the implemented normalized gain feature in `index.html`.

Goal:
- Keep playback volume more consistent across songs.
- Preserve user control with per-song manual override.
- Keep implementation native to Web Audio API and local storage.

## What is implemented
1. Automatic loudness analysis for songs:
   - Uses offline perceptual filtering and gated RMS analysis.
   - Produces a normalized linear gain per song.
2. Global auto mode:
   - `autoGainEnabled` (default ON).
   - Controls whether normalized gain is used by default.
3. Per-song manual override:
   - User moves volume slider -> current song switches to manual override when global auto is ON.
4. Per-song mode toggle in EQ + Volume sheet:
   - Tap the volume value to toggle AUTO/MANUAL for the current song (only when global auto is ON).
   - Visual mode indicator:
     - AUTO: `A 1.23` + accent color
     - MANUAL: `1.23` + default text color
5. Settings controls:
   - Global checkbox: Auto normalized volume.
   - Recalculate button.
   - All songs checkbox for force recalculation.
6. AEM metadata integration:
   - Export includes `normalization` object.
   - Import restores normalization if present.
   - If missing, normalization is computed during import.

## Core signal path
Playback still uses a single effective gain stage:
- `source -> bass -> mid -> treble -> playbackGain -> destination`

Effective gain is resolved by `resolveEffectiveGain(songName)` and applied by `applyPlaybackGain(songName)`.

## Loudness analysis method
Current method version:
- `hprms-gated-v1`

Pipeline:
1. Decode file to `AudioBuffer`.
2. Run through `OfflineAudioContext` perceptual filters:
   - High-pass (around 190 Hz)
   - Optional high-shelf (mild boost)
3. Compute block RMS (`~400 ms` blocks).
4. Compute preliminary integrated RMS.
5. Apply relative gate (`-20 dB` from preliminary level).
6. Recompute integrated RMS from gated blocks.
7. Compute original-signal peak.
8. Compute target gain with safety:
   - target RMS ratio
   - no-clip cap via peak headroom
   - clamp gain range
9. Persist result per song.

Fallback behavior:
- If analysis fails or signal is effectively silent, safe fallback gain is `1.0`.

## Storage model
Keys used:
1. `audio_normalization_map_v1`
   - Per-song normalization entry:
     - `gain`
     - `measuredRms`
     - `peak`
     - `analyzedAt`
     - `methodVersion`
2. `audio_auto_gain_enabled_v1`
   - Global auto mode flag (`1` or `0`).
3. `audio_manual_override_map_v1`
   - Per-song override map (`songName -> true`).
4. Existing manual volume remains in `audio_volume_map_v1`.

Global toggle rule:
- Changing global auto clears per-song manual overrides.
- Manual volume values are preserved.

## Runtime behavior rules
Song load:
1. Resolve effective mode/gain via `resolveEffectiveGain(songName)`.
2. Apply once via `applyPlaybackGain(songName)`.

Slider move:
1. Save manual volume for current song.
2. If global auto is ON, set per-song manual override.
3. Re-apply effective gain and refresh UI.

Value-label tap in EQ + Vol sheet:
1. If global auto is OFF: no-op.
2. If global auto is ON:
   - AUTO -> MANUAL (set per-song override)
   - MANUAL -> AUTO (clear per-song override)
3. Re-apply effective gain and refresh UI.

## Settings workflow
In info/settings sheet:
1. Auto normalized volume (global checkbox)
   - ON: normalized gain is default unless song has manual override.
   - OFF: manual gain for all songs.
2. Recalculate
   - Default: analyze songs missing usable/current-method normalization.
   - With `All songs` checked: force recalc every song.

Progress and summary:
- Uses existing busy dialog and export notice system.

## Import/export behavior
Raw audio add/import:
- Normalization is analyzed and persisted as part of flow.

AEM export:
- Metadata now includes `normalization`.

AEM import:
- If `metadata.normalization` exists and is valid -> restore.
- Else -> analyze and persist during import.

## Method-version refresh behavior
`recalculateNormalizationForLibrary()` treats normalization as stale when:
- entry is missing/invalid, or
- `entry.methodVersion` differs from current method version.

This ensures the library can be migrated when analysis algorithm changes.

## UX details implemented
1. `A` prefix shown only in AUTO mode.
2. Color is secondary cue (AUTO accent, MANUAL default).
3. Value labels use minimum width to reduce layout jitter.
4. EQ + Volume sheet labels/preset text are non-selectable to reduce Android text-selection popups.

## Known limitations
1. Full perceptual loudness is approximate (not full LUFS standard implementation).
2. Validation of subjective loudness and mobile touch behavior still requires manual device testing.

## Quick test checklist
1. Add 2-3 songs with different loudness profiles.
2. Confirm normalization entries are created.
3. Confirm global auto ON applies normalized defaults.
4. Move slider and confirm per-song manual override activates.
5. Tap EQ volume value and confirm mode toggles AUTO/MANUAL.
6. Toggle global auto OFF/ON and confirm overrides clear but manual values remain.
7. Export/import AEM and confirm normalization restores.
8. Use Recalculate (missing only and all songs) and verify progress/summary.

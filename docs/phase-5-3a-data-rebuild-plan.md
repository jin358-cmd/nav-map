# Phase 5.3A POI data rebuild plan

## Decision

`south-pilot-20260913-batch10` is retained as historical evidence, but it is not importable. Its 812,257-row source file with SHA-256 `657c34315a8ea072f564722607ff4edcce146d76e2af41bcc330d6b0a2fc490f` was stored only in an ephemeral `/tmp/phase53a-src` directory and cannot be recovered from the workspace or GitHub.

The replacement version is `south-pilot-20260920-rebuild1`. It must be generated from new, timestamped source snapshots. Its counts and hashes must not be copied from the legacy reports.

## Required sequence

1. Download and preserve timestamped snapshots of the GCIS inputs and other POI bases used by the ingest pipeline.
2. Run the GCIS/NLSC pipeline with checkpointing and rate limits. Never restart completed ranges merely to obtain a different count.
3. Produce `taiwan-poi-index.json.gz`, then record its byte size, row count, SHA-256, source snapshot timestamps, and generating Git commit.
4. Copy the source artifact to persistent storage. A local or cloud-agent temporary directory does not satisfy this gate.
5. Run the national integrity checks: parse success, unique IDs, unique `(source, source_id)`, valid coordinates, and reproducible category/count summaries.
6. Regenerate the south-pilot summary and data-version files under the new version name. Preserve the legacy files unchanged.
7. Run a Yunlin-only, published-only dry-run. The importer must report the selected source path, matching SHA, actual per-county counts, and `wroteSupabase=false`.
8. Stop for explicit authorization before setting `SOUTH_POI_APPLY=1`.
9. If authorized, import Yunlin only into NavPilot project `rxzbsthsqlozxgctdoks`, then reconcile cloud counts and record the run. Never operate on `qmptlkgseffmeqnarwnb`.

## Blocking conditions

Stop without writing to Supabase when any of these conditions is true:

- The source file is absent or its SHA-256 differs from the manifest.
- Actual county counts differ from the regenerated summary.
- The source artifact has not been copied to persistent storage.
- The linked Supabase project is not `rxzbsthsqlozxgctdoks`.
- Explicit apply authorization has not been recorded.
- A batch fails reconciliation or reaches the consecutive-failure limit.

The machine-readable status and gates are in `data/south-pilot/rebuild-manifest.json`.

## Current progress

The GCIS input snapshot and existing POI base were archived under `data/source-snapshots/south-pilot-20260920-rebuild1` on 2026-09-20. All 56 selected GCIS files passed SHA-256 verification (472,637,691 bytes total). The snapshot manifest SHA-256 is `a40b935abcdff35ef9787754ba0a3a5e8f20a6bceec853db1c47105c444e3a80`.

`sourceSnapshotArchived` remains false until the NLSC geocoding results and checkpoints are also preserved. No rebuilt POI source has been generated and no Supabase data write has occurred.

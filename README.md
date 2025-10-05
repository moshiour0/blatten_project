Webpage Link : https://moshiour0.github.io/blatten_project/


# README — **Save Blatten & Beyond**
**Rapid response to glacier- and man-made disasters using SAR + optical change detection**
This repository contains the demo pipeline, notebooks, web UI, and processing graphs used for the NASA Space Apps — Zurich (Blatten) entry.

> Goal: demonstrate a reproducible end-to-end pipeline that detects and visualizes displacement at Blatten using Sentinel-1 (SLC / GRD) and Sentinel-2 optical data (custom B12-B2-B1 RGB), produce precomputed change polygons (GeoJSON), and present a judged-ready dashboard with time-lapse, alerts and story map.
> The repo is designed to be runnable locally (no cloud credits required) and extensible to **live monitoring** later.

---

# Table of contents

1. [Project overview & vision](#project-overview--vision)
2. [Repository layout (recommended)](#repository-layout-recommended)
3. [Quick start — run demo locally (5 minutes)](#quick-start---run-demo-locally-5-minutes)
4. [Conda environment (environment.yml)](#conda-environment-environmentyml)
5. [SNAP: graph processing & how to run your graphs (SLC / GRD / S2)](#snap-graph-processing--how-to-run-your-graphs-slc--grd--s2)
6. [Notebooks (what each does and how to run)](#notebooks-what-each-does-and-how-to-run)
7. [Front-end (HTML / CSS / JS) — run & customize](#front-end-html--css--js---run--customize)
8. [How we detected displacement — scientific explanation (short)](#how-we-detected-displacement---scientific-explanation-short)
9. [How to produce precomputed GeoJSON change polygons (pipeline summary)](#how-to-produce-precomputed-geojson-change-polygons-pipeline-summary)
10. [Future: adding live monitoring & production architecture](#future-adding-live-monitoring--production-architecture)
11. [Troubleshooting & tips](#troubleshooting--tips)
12. [Credits & license](#credits--license)

---

# Project overview & vision

We combine:

* **Sentinel-1 (SAR)** SLC → interferometric processing (DInSAR): velocity, unwrapped phase → LOS displacement and coherence maps. This is the primary, cloud-independent sensor used for early-warning.
* **Sentinel-1 GRD** for rapid amplitude differencing and quick mapping (fast mapping when SLC processing is not needed).
* **Sentinel-2 (optical)** custom composite `R=B12, G=B2, B=B1` that highlights displaced soil as reddish-brown vs stable dark-brown rock and blue snow — this is used for human-readable change visualization and to validate/triangulate SAR-derived change.
* **Automated detection pipeline**: amplitude/NDVI/difference + color heuristics + morphological filtering → raster masks → vectorize → produce `high_risk.geojson` for the dashboard.
* **Web Dashboard** (single `index.html`) showing map, S2 time-lapse, change polygons, and alerts. The dashboard consumes precomputed assets (PNG frames, GeoJSON, tiles).

This README documents how to reproduce Phase 1 and how to move to continuous monitoring later.

---

# Repository layout (recommended)

Organize your repo like this (you can adjust names — update `FRAME_PATH` in JS accordingly):

```
/ (repo root)
├─ README.md
├─ environment.yml
├─ index.html                 # All-in-one demo HTML (contains CSS + JS)
├─ frontend/
│  ├─ assets/
│  │  └─ s2_animation/        # PNG frames used by the dashboard (B12-B2-B1 composites)
│  ├─ web_tiles/              # optional tiles (if you create gdal2tiles output)
│  └─ derived/
│     └─ risk/
│        └─ high_risk.geojson
├─ data/
│  └─ blatten_phase1/
│     ├─ sentinel1/
│     │  ├─ slc/              # raw SLC zips
│     │  └─ grd/              # raw GRD
│     └─ sentinel2/
│        └─ l2a/              # SAFE or .tif files
├─ snap_graphs/
│  ├─ slc_insar_graph.xml     # the SNAP graph you used / exported
│  ├─ grd_preprocess_graph.xml
│  └─ s2_resample_graph.xml
├─ notebooks/
│  ├─ S2_png_process.ipynb
│  ├─ pre_process_of_geojson.ipynb
│  └─ produce_geojson.ipynb
├─ scripts/
│  ├─ run_gpt.sh              # helpful wrapper to run SNAP gpt with a .xml
│  └─ manifest_generator.py   # optional: build frames.json from folder
└─ docs/
   └─ processing_notes.md
```

---

# Quick start — run demo locally

1. **Create & activate conda env**

   ```bash
   conda env create -f environment.yml
   conda activate save-blatten
   ```

2. **Place assets**

   * Put your S2 PNG frames (B12-B2-B1 composites) under `frontend/assets/s2_animation/` (filenames must match the JS frames list inside `index.html` or edit `FRAME_PATH` in the JS).
   * Put `high_risk.geojson` at `frontend/derived/risk/high_risk.geojson`.

3. **Start a static server** (recommended — avoids CORS)

   ```bash
   # from repo root:
   python -m http.server 8000
   # then open:
   http://localhost:8000/index.html
   ```

4. **Open Jupyter / run notebooks** (if you want to re-generate frames / geojson)

   ```bash
   jupyter lab   # then open notebooks/
   ```

---

# Conda environment (environment.yml)

Save this as `environment.yml`. It installs geospatial Python stack and Jupyter. Note: ESA SNAP is *not* installed via conda — see SNAP instructions below.

```yaml
name: save-blatten
channels:
  - conda-forge
dependencies:
  - python=3.10
  - jupyterlab
  - notebook
  - ipykernel
  - numpy
  - pandas
  - matplotlib
  - imageio
  - pillow
  - scikit-image
  - scikit-learn
  - rasterio
  - rioxarray
  - xarray
  - geopandas
  - shapely
  - fiona
  - pyproj
  - rasterstats
  - sentinelsat
  - affine
  - tqdm
  - notebook
  - nodejs           # optional: if you want to run local front-end tooling
  - git
  - pip
  - pip:
      - mapbox_vector_tile   # optional
      - whitebox             # optional imagery morphology
```

**Important**: ESA SNAP Desktop (Graph Processing Tool `gpt` and `snappy`) is not distributed via conda reliably. Install SNAP separately (see next section) and configure `snappy` if you want Python bindings.

---

# SNAP — Graph processing (SLC interferogram & GRD preprocessing & S2 resample)

You produced SNAP processing graphs. Below is a human-readable step-by-step of the graphs you posted, and how to run them:

## What each graph does (SLC Interferometry graph summary)

This graph performs classic DInSAR stack processing (pair of SLCs → interferogram → filter → unwrap → displacement):

1. **Read** — load SLC product (zip).
2. **TOPSAR-Split** — keep specific subswath (IW1) and polarisation (VV). Also select bursts (firstBurstIndex/lastBurstIndex) to focus AOI.
3. **Apply-Orbit-File** — apply precise orbit file (Sentinel Precise) for accurate geolocation and baseline estimation.
4. **TOPSAR-Deburst** — merge bursts into a continuous image.
5. **Back-Geocoding** — coregister master and slave (backgeocoding uses DEM to remap slave to master geometry). DEM: SRTM 1Sec.
6. **Interferogram** — build interferogram (subtract flat-earth and topography). Also output coherence.
7. **GoldsteinPhaseFiltering** — spectral filtering of the phase to reduce noise.
8. **BatchSnaphuUnwrapOp** — export to SNAPHU or call SNAPHU for phase unwrapping.
9. **PhaseToDisplacement** — convert unwrapped phase to LOS displacement (units: meters).
10. **Terrain-Correction** — geocode to map projection (CH1903+/LV95), resample to desired pixel spacing.
11. **Terrain-Correction(2)** — same for the coherence product.
12. **BandMerge** — merge bands (coherence + displacement).
13. **Write** — write BEAM-DIMAP output (GeoTIFFs can be created by export if needed).

### How to run a SNAP graph

* Install **ESA SNAP Desktop** (download and install via the SNAP installer for your OS).
* Export your graph as `.xml` (you already have XML if you saved the graph).
* Run it from terminal using the `gpt` command (installed with SNAP). Example:

```bash
# Example (on local machine where SNAP is installed):
gpt snap_graphs/slc_insar_graph.xml
```

You can also pass parameters with `-Pparam=value` if your graph is set up for parameterization.

If you prefer to call from Python, use `subprocess`:

```python
import subprocess
subprocess.run(['gpt', 'snap_graphs/slc_insar_graph.xml'], check=True)
```

**SNAPHU**: ensure SNAPHU is installed and the path matches `BatchSnaphuUnwrapOp` settings. The SNAP GUI or the Graph XML includes SNAPHU calling path.

---

## GRD preprocessing graph summary (quick mapping)

Pipeline for GRD to geocoded, radiometrically-calibrated, speckle-filtered, debiased GeoTIFF:

1. **Read** — GRD product (.SAFE or .zip).
2. **Subset** — crop to AOI (geoRegion polygon).
3. **Apply-Orbit-File** — apply precise orbit.
4. **ThermalNoiseRemoval** — remove thermal noise contributions.
5. **Calibration** — convert to sigma0 or gamma0 (radiometric calibration).
6. **Speckle-Filter** — Refined Lee speckle filter or similar.
7. **Terrain-Correction** — apply DEM & geocode to target projection & resolution.
8. **LinearToFromdB** — convert to dB (if needed).
9. **Write** — write GeoTIFF outputs.

**Run with**: `gpt snap_graphs/grd_preprocess_graph.xml`

---

## Sentinel-2 resample graph summary

1. **Read** — load S2 L2A product.
2. **Resample** — resample bands to 10 m resolution.
3. **Subset** — crop to AOI region.
4. **Write** — write GeoTIFF.

**Run with**: `gpt snap_graphs/s2_resample_graph.xml`

---

# Notebooks — what each does & how to run

All notebooks are in `/notebooks/`. Use `jupyter lab` to open them.

1. **S2_png_process.ipynb**

   * Loads Sentinel-2 L2A resampled GeoTIFFs (10m bands).
   * Applies your **custom RGB mapping**: `R = B12 (scale 0.3–1), G = B2 (0–1), B = B1 (0–1)`. (Notebook includes normalization and clipping.)
   * Optionally applies cloud mask filtering (SCL or cloud probability).
   * Exports 8-bit PNGs (downsampled to a reasonable display size, e.g., max 2048 px width) for dashboard animation.
   * **Run**: open notebook → update file paths to your `derived/s2_outputs/*.tif` → run cells. Notebook saves PNGs to `frontend/assets/s2_animation/`.

2. **pre_process_of_geojson.ipynb**

   * Inputs: S2 PNG composites + GRD/ SLC-derived products (coherence, velocity, amplitude diff).
   * Procedure (cells):

     * Load amplitude difference rasters and/or optical difference images.
     * Apply masks: cloud mask (S2 SCL), no-data, slope threshold (using DEM), snow filter if necessary.
     * Threshold amplitude/optical difference to get candidate change mask.
     * Use morphological opening/closing to denoise and remove tiny objects.
   * Output: cleaned raster mask and preview maps. (Saved under `data/blatten_phase1/derived/`.)

3. **produce_geojson.ipynb**

   * Vectorizes the cleaned raster mask (rasterio.features.shapes) → polygons.
   * Filters polygons by area, compactness, and distance to known infrastructure.
   * Adds metadata properties: `frameIndex`, `detected_on` (date), `confidence` (0..1), `area_m2`.
   * Simplifies polygons (`shapely.simplify`) for web performance.
   * Writes `frontend/derived/risk/high_risk.geojson`.
   * Notebook also creates a small **validation image** (PNG) with the polygon overlay onto a base S2 frame for judges.

**Tip**: Keep notebooks parameterized (top cell constants). Commit the final generated GeoJSON + frames to your repo before presenting (or keep them in Git LFS if large).

---

# Front-end (HTML / CSS / JS) — run & customize

* We produced an **all-in-one `index.html`** that contains the UI and JS logic (Leaflet map, S2 animation controls, toggle layers, GeoJSON overlay).
* **Important configuration** (in the HTML JS section):

  * `FRAME_PATH` and `frames[]` — point to your PNG frames.
  * `CHANGE_GEOJSON_PATH` — point to `frontend/derived/risk/high_risk.geojson`.
  * `OVERLAY_BOUNDS` — ensure the lat/lon bounds match your generated PNG extent.
* Local serve: `python -m http.server 8000` and open `http://localhost:8000/index.html`.
* For the hackathon demo, keep PNGs reasonably sized (< 4MB each). Judge machines will thank you.

---

# How we detect displacement — short, scientific description

1. **InSAR (DInSAR) detection**

   * From SLC pairs we compute interferograms and coherence. After Goldstein filtering and SNAPHU unwrapping, phase is converted to LOS displacement (meters). Time-series of LOS velocity reveal acceleration prior to collapse. Coherence drops indicate violent structural change or surface disruption.

2. **Optical (S2) detection**

   * The custom `B12-B2-B1` composite is chosen because: band 12 (SWIR) is sensitive to moisture and bare/soft soil reflectance (reddish-brown), band 2 is a strong green channel and band 1 adds fine detail for snow/ice contrast. Visual differences between frames are highlighted by amplitude difference and color shifts. We threshold and morphological-filter optical change to build candidate polygons.

3. **Fusion & alerting**

   * Alerts are issued if SAR velocity exceeds a configurable threshold (e.g., > 2.0 m/day) **and** optical change is co-located — this reduces false positives from transient snow/seasonal effects.

4. **GeoJSON generation**

   * Raster mask → connected components → area & shape filtering → polygon properties (`frameIndex`, `confidence`) → saved as `high_risk.geojson`. The dashboard consumes this GeoJSON and shows polygons at the frame when change was detected.

---

# Pipeline summary — produce precomputed GeoJSON (end-to-end)

1. Acquire S2 L2A images (within timeframe & cloud < 30%). Use Sentinel API, Planetary Computer, or your local data.
2. Run S2 resample graph in SNAP (10 m) and export GeoTIFF.
3. From S2 GeoTIFFs generate B12-B2-B1 PNGs (`S2_png_process.ipynb`).
4. Acquire Sentinel-1 SLC pairs that bracket the timeframe and run DInSAR graph (`slc_insar_graph.xml`) to produce displacement (LOS velocity) and coherence rasters.
5. Generate GRD amplitude differences for quick-change mapping (`grd_preprocess_graph.xml`) when SLC is not needed.
6. Run `pre_process_of_geojson.ipynb` to create cleaned change mask.
7. Run `produce_geojson.ipynb` to vectorize and simplify polygons, add metadata and write `high_risk.geojson`.
8. Move `PNG` frames & `high_risk.geojson` to the front-end folders and serve the site.

---

# Future: adding live monitoring & production architecture (conceptual + practical plan)

We built a reproducible offline demo. For **continuous/live monitoring** (production), consider the following pattern:

## High-level architecture

1. **Ingestion**

   * Use AWS Open Data (Sentinel-1 on S3) or Copernicus Data Space API / ASF Vertex to programmatically fetch new Sentinel-1 / Sentinel-2 acquisitions for AOIs. Or use Microsoft Planetary Computer / Google Earth Engine for automated ingestion.
   * Use Meteomatics or MeteoSwiss for local weather triggers.

2. **Processing pipeline (serverless or VM/cluster)**

   * Containerize processing steps:

     * SNAP (gpt) in a container or use pyroSAR + SNAP on a VM for InSAR runs.
     * Lightweight optical/ raster tasks in Python (rasterio / rioxarray) in Docker containers.
   * Or use Google Earth Engine / Planetary Computer for optical composites (fast, serverless).

3. **Orchestration**

   * Schedule with **Cloud Functions / Cloud Run / AWS Lambda + Step Functions** or a **Kubernetes CronJob** for repeated processing.
   * For low-cost hackathon demo use a single small VM / instance with a cron job or a GitHub Actions workflow that triggers processing nightly.

4. **Change detection & decision rules**

   * Run detection tasks; if conditions met (velocity, confidence, overlapping optical change), save updated GeoJSON and push to the web host and notify via webhook (Slack / email / SMS).

5. **Delivery**

   * Host web UI on GitHub Pages (static) with assets in a cloud object store (S3) or serve static via a web server. Use a small API (Flask / FastAPI) for optional pixel-value queries or timeseries.

6. **Alerting & human-in-loop**

   * Send alerts to emergency coordinators with map links. All automated alerts require clear thresholds and a small human verification step before wide notifications.

## Practical roadmap for your team (fastest path)

* **Phase 0 (Demo)**: static precomputed assets (what you have now). Serve with `python -m http.server` or GitHub Pages.
* **Phase 1 (Automated nightly)**: provision a small VM (or Google Cloud Run) with SNAP installed and a cron job to pull the latest Sentinel acquisitions for your AOI, run the graphs, and publish `high_risk.geojson`.
* **Phase 2 (Near real-time)**: ingest from AWS S3 Sentinel-1 open data using event notifications (S3 event → lambda → trigger processing). Use a queue for processing jobs.
* **Phase 3 (Scale & robustness)**: orchestrate with Kubernetes; store artifacts in object storage; add monitoring, logs, retries and CI tests.

---

# Troubleshooting & tips

* **CORS problems with PNG/GeoJSON**: serve everything from the same host (simple: `python -m http.server`) or configure CORS correctly.
* **Large PNGs slow the browser**: downsample to 1024–2048 px for demo. Use `imageio` or `Pillow` to resize in the notebook.
* **SNAP errors**: check `gpt` console logs. If SNAPHU fails, ensure SNAPHU binary path is set and that `BatchSnaphuUnwrapOp` points to a valid install.
* **GeoJSON too big**: simplify polygons (`shapely.simplify`) with a small tolerance (e.g., 5–20 meters) before committing.
* **Frame / date mismatch**: ensure `frames.length === dates.length` and filenames are exact (case sensitive).
* **Versioning**: commit final assets (PNG + GeoJSON) to Git (or use Git LFS for large files).

---

# Helpful commands & examples

```bash
# start static server
python -m http.server 8000

# run SNAP graph (on machine with SNAP installed)
gpt snap_graphs/slc_insar_graph.xml

# run jupyter lab
conda activate save-blatten
jupyter lab

# create frames manifest (example script)
python scripts/manifest_generator.py frontend/assets/s2_animation/ > frontend/assets/s2_animation/frames.json
```

---

# What to include in your final hackathon submission (packaging)

1. `index.html` (the demo), and the `frontend/assets/s2_animation` PNG frames.
2. `frontend/derived/risk/high_risk.geojson` and a small validation PNG showing polygon overlay.
3. `notebooks/` with `S2_png_process.ipynb`, `pre_process_of_geojson.ipynb`, `produce_geojson.ipynb`. Confirm notebook cells that create final outputs are run and outputs saved.
4. `snap_graphs/` with the `.xml` graphs you used (so judges can reproduce your SNAP run).
5. `environment.yml` and a short `run_instructions.txt` (or include this README).
6. Short **one-page README summary** (this file) and a README section inside the Space Apps submission describing your novelty (SAR+optical fusion + live concept).

---

# Credits & license

* Data: ESA Copernicus (Sentinel-1/2), NASA (SRTM, other), Swiss open data (MeteoSwiss, GLAMOS) — all open-source as per providers.
* Tools: ESA SNAP, Python (rasterio, geopandas, numpy), Leaflet.
* License: choose an appropriate open license (e.g., MIT) and add `LICENSE` to repo.

---


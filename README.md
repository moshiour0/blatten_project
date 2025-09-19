# Blatten GitHub Template — ready-to-push files + step-by-step guide

This document contains everything you need to create a **future-proof GitHub repo** for your Save Blatten & Beyond project: `environment.yml`, `.gitignore`, `.gitattributes` (Git LFS), README skeleton, manifest template, and detailed step-by-step commands (PowerShell-friendly) to push the repo and handle heavy data.

---

## 1) Files included in this template (copy these into your local folder `D:\blatten_project`)

### environment.yml

```yaml
name: blatten_phase1
channels:
  - conda-forge
  - defaults
dependencies:
  - python=3.11
  - geopandas
  - rasterio
  - shapely
  - fiona
  - pyproj
  - gdal
  - jupyterlab
  - pandas
  - sentinelsat
  - requests
  - tqdm
  - matplotlib
  - numpy
  - scikit-image
  - scikit-learn
  - netcdf4
  - pip
  - pip:
      - earthengine-api
      - asf-search
      - setuptools
      - wheel
```

---

### README.md (starter)

````markdown
# Save Blatten & Beyond (NASA Space Apps 2025 — Challenge 8)

Short description: Satellite SAR + optical workflows to detect glacier instability and rapid response mapping for the 2025 Blatten event.

## Quick start
1. Clone the repo
```bash
git clone https://github.com/<your-username>/blatten_project.git
cd blatten_project
````

2. Create the environment

```bash
conda env create -f environment.yml
conda activate blatten_phase1
jupyter lab
```

3. Run scripts

* `scripts/run_grd_batch.ps1` — process Sentinel-1 GRD zips into dB GeoTIFFs
* `scripts/run_s2_batch.ps1` — run S2 resample graph
* `scripts/generate_metadata_csv.py` — create `metadata_products.csv`

## Repo layout

* `data/` (NOT tracked) — raw/derived assets (see `.gitignore`)
* `notebooks/` — Jupyter notebooks (analysis + GEE)
* `scripts/` — automation scripts
* `snap_graphs/` — SNAP XML workflows
* `results/` — small maps & quicklooks for judges

## Data access (important)

Large files are NOT stored in this Git repo. Use one of these options and put the public link(s) here:

* **Zenodo** (archive + DOI): recommended for final archival & DOI (up to 50 GB record default). See the `data_links` below.
* **GitHub Releases** (for final large ZIPs < 2 GB per asset).
* **Cloud storage (S3 / Google Cloud / Drive)** for iterative / team sharing.

### data\_links (example placeholders)

* Sentinel-1 GRD processed (small sample): `data/sample/grd_sample.zip`
* Full GRD/SLCS archive (external): `https://drive.google.com/....` or `s3://my-bucket/blatten/`
* Zenodo DOI (final): `https://doi.org/10.5281/zenodo.xxxxxx`

## How judges run this

1. Clone repo
2. Install environment using `environment.yml` (or open binder/github codespace if provided)
3. Download full data (links in `README.md`) OR use included small sample in `data/sample/`
4. Open `notebooks/` in JupyterLab

## License

Pick a license (MIT recommended) and add a `LICENSE` file.

```

---

### .gitignore
```

# Python

**pycache**/
\*.pyc
\*.pyo
\*.pyd
.env
envs/

# Data + large files

data/
\*.zip
\*.tif
\*.nc
\*.h5

# Jupyter

.ipynb\_checkpoints/

# OS

.DS\_Store
Thumbs.db

```

---

### .gitattributes (for Git LFS)
```

\*.tif filter=lfs diff=lfs merge=lfs -text
\*.zip filter=lfs diff=lfs merge=lfs -text
\*.h5 filter=lfs diff=lfs merge=lfs -text

```

---

### manifest template (manifest.csv header)
```

product\_id,title,platform,product\_type,acq\_date,orbit\_pass,relative\_orbit,polarisation,file\_path,source

````

---

## 2) Step-by-step: create repo locally and push to GitHub (PowerShell)

> Replace `<your-username>` and repo name as needed.

1. Open PowerShell and go to your project root
```powershell
cd D:\blatten_project
````

2. Initialize git, add files, commit

```powershell
git init
git add .
git commit -m "Initial commit: blatten project skeleton"
```

3. Create a repository on GitHub (GUI recommended for beginners)

* Go to [https://github.com](https://github.com) → New repository → name `blatten_project` → *do not* initialize with README (we have ours locally) → Create repo.

4. Add remote and push

```powershell
git branch -M main
git remote add origin https://github.com/<your-username>/blatten_project.git
git push -u origin main
```

---

## 3) Set up Git LFS (if you will version large media or GeoTIFFs)

> **Important:** GitHub LFS gives a small free quota (see README in chat). For many large SAR files, prefer external storage.

1. Install Git LFS

* Download installer from [https://git-lfs.github.com/](https://git-lfs.github.com/) or use package manager.

2. Initialize and track file types

```powershell
git lfs install
git lfs track "*.tif"
git add .gitattributes
git commit -m "Track TIFFs with LFS"
```

3. Add and push large files (be careful with quota)

```powershell
git add path\to\large_file.tif
git commit -m "Add processed tif"
git push origin main
```

---

## 4) Alternatives for heavy data (recommended options)

### Option A — Zenodo (best for archival & DOI)

* Zenodo records can accept up to 50 GB by default per record (good for a final dataset/zip). Use the web UI to upload and publish the final dataset. This gives a DOI and is ideal for citations.

  * Steps: create Zenodo account → New upload → drag & drop files (or upload via API) → publish → copy DOI → paste DOI in your README `data_links`.

### Option B — GitHub Releases (convenient for final zips)

* Releases let you attach binary assets; each asset must be under **2 GiB**. No strict total release size limit. Good for distributing pre-built artifacts (e.g. `blatten_results_v1.zip`).

  * In GitHub: Repository → Releases → Draft new release → upload asset(s) → Publish.

### Option C — Cloud storage (fast & scalable)

* **AWS S3**, **Google Cloud Storage**, or **Azure Blob** are cheap and robust. Store SLCs or processed stacks here and give the bucket link or pre-signed URLs in README.

  * If you use AWS S3, install AWS CLI and run:

    ```powershell
    aws s3 cp "D:\bigfile.tif" s3://my-buckname/blatten/bigfile.tif
    aws s3 presign s3://my-buckname/blatten/bigfile.tif --expires-in 604800
    ```
  * Use lifecycle rules to move old data to Glacier to save cost.

### Option D — Google Drive / Dropbox (quick but less robust)

* Easiest for hackathons. Upload archives and paste share links in README. Judges can download easily.

### Option E — HyP3 / ASF or Terra/AWS open data

* For SAR SLC/GRD you can point judges to cloud-hosted sources (AWS Sentinel-1 open data) or HyP3 outputs — provide scripted download instructions (e.g. `asf-search` or `sentinelsat`) instead of hosting raw SLC yourself.

---

## 5) Recommended hosting plan for the Blatten project (practical, minimal-cost)

1. **In-repo (GitHub)**: only lightweight files (notebooks, scripts, graphs, README, small sample data <200 MB total, quicklook PNGs). This makes the repo fast to clone.
2. **Final deliverables (for judges)**: upload a single ZIP of results (\~<2 GB) as a **GitHub Release** or host on Zenodo for DOI (if final archive <50 GB). Link it in README.
3. **Huge raw data (SLCs, big stacks)**: keep on AWS S3 or Google Drive (private until you share). Provide script in `scripts/` to download via `asf-search`, `sentinelsat`, or `aws s3 cp` so users can reproduce.
4. **Processed intermediate data**: if you must share some processed GeoTIFFs, put a small subset in the repo and store the full set on S3 / Zenodo.

---

## 6) Creating a GitHub Template (one-click for collaborators)

1. Push your repo to GitHub (as above).
2. On GitHub, open your repo → Settings → Template repository → check **Template repository**. Now other users can click **Use this template** to create their own copy.

---

## 7) Quick checklist before you push

* [ ] `environment.yml` present
* [ ] `README.md` contains data links and steps for judges
* [ ] `notebooks/` contains at least one demo notebook with a **small sample** dataset
* [ ] `.gitignore` excludes `data/` (don’t commit big raw files)
* [ ] `.gitattributes` added if you plan to use Git LFS
* [ ] If using LFS, check your quota on GitHub or have a payment method for extra storage

---

## 8) Example PowerShell commands for a small workflow (summary)

```powershell
cd D:\blatten_project
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/blatten_project.git
# If using LFS:
git lfs install
git lfs track "*.tif"
git add .gitattributes
git commit -m "Track tiffs with git-lfs"
# Push
git push -u origin main
```

---

## 9) Notes & warnings

* **Do not** store multi-GB raw SLCs in GitHub (push will be blocked or you'll run out of quota). Use cloud storage or HyP3. Keep only small, reproducible samples in the repo.
* If you accidentally commit a large file, remove it from git history with `git filter-repo` or `git filter-branch` and then force-push (but be careful — this rewrites history).
* If you want me to create the initial GitHub repo skeleton for you (I can prepare the files and show the exact commands), say **"create template"** and I will generate the files in the canvas for you to download and push.

---

## 10) Final checklist for me to do next (if you want)

* [ ] Generate the repo skeleton files (README.md, environment.yml, .gitignore, .gitattributes, sample notebooks) in a ZIP for you to download.
* [ ] Draft the GitHub release ready ZIP (small demo) and instructions to upload to Releases.
* [ ] Write `scripts/download_data.sh` (or `.ps1`) that uses `asf-search` / `sentinelsat` to fetch required inputs for reproduction.

If you want me to **generate the files now** (README + environment.yml + .gitignore + .gitattributes + a tiny demo notebook stub and push-ready instructions), reply **"generate template"** and I will create the download package here.

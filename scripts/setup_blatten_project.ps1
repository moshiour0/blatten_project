################################################################################
# setup_blatten_project.ps1
# Run as Administrator (right-click PowerShell -> Run as Administrator).
# Safe to re-run. Creates environment with Python 3.11 on D: drive.
################################################################################

# -------------------------
# CONFIG
# -------------------------
$CondaRoot   = "D:\miniconda3"
$ProjectRoot = "D:\blatten_project"
$EnvPrefix   = "$ProjectRoot\envs\blatten_phase1"
$LogFile     = Join-Path $ProjectRoot "setup_log.txt"

$CondaPkgs = @(
    "python=3.11",
    "geopandas",
    "rasterio",
    "shapely",
    "fiona",
    "pyproj",
    "gdal",
    "jupyterlab",
    "pandas",
    "sentinelsat",
    "requests",
    "tqdm",
    "matplotlib",
    "numpy",
    "scikit-image",
    "scikit-learn",
    "netcdf4"
)

$PipPkgs = @("earthengine-api", "asf-search", "setuptools", "wheel")

# -------------------------
# Helper: logging
# -------------------------
function Log {
    param($s)
    $t = (Get-Date).ToString("s")
    "$t`t$s" | Out-File -FilePath $LogFile -Append -Encoding utf8
    Write-Host $s
}

# -------------------------
# 0) Admin check
# -------------------------
if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltinRole]::Administrator)) {
    Write-Error "Run this script as Administrator."
    exit 1
}

# -------------------------
# 1) Ensure project folders
# -------------------------
foreach ($folder in @($ProjectRoot, (Split-Path -Parent $EnvPrefix))) {
    if (-not (Test-Path $folder)) {
        New-Item -ItemType Directory -Path $folder -Force | Out-Null
        Log "Created folder: $folder"
    } else {
        Log "Folder exists: $folder"
    }
}

# -------------------------
# 2) Check conda/mamba
# -------------------------
$CondaExe = Join-Path $CondaRoot "Scripts\conda.exe"
$MambaExe = Join-Path $CondaRoot "Scripts\mamba.exe"

if (-not (Test-Path $CondaExe)) {
    Write-Error "Miniconda not found at $CondaRoot. Please install Miniconda3 x64."
    exit 1
}
Log "Miniconda found at $CondaRoot"

# -------------------------
# 3) Create environment (if missing)
# -------------------------
if (Test-Path $EnvPrefix) {
    Log "Environment already exists at $EnvPrefix"
} else {
    if (Test-Path $MambaExe) {
        Log "Creating environment with mamba..."
        & $MambaExe create -y -p $EnvPrefix -c conda-forge @CondaPkgs
    } else {
        Log "Mamba not found, using conda..."
        & $CondaExe create -y -p $EnvPrefix -c conda-forge @CondaPkgs
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Error "Environment creation failed"
        exit 1
    }
    Log "Environment created"
}

# -------------------------
# 4) Install pip packages
# -------------------------
& $CondaExe run -p $EnvPrefix python -m pip install --upgrade pip
& $CondaExe run -p $EnvPrefix python -m pip install $PipPkgs
Log "Pip packages installed"

# -------------------------
# 5) Create project folder tree
# -------------------------
$Folders = @(
    "$ProjectRoot\data\blatten_phase1\sentinel1\grd",
    "$ProjectRoot\data\blatten_phase1\sentinel1\slc",
    "$ProjectRoot\data\blatten_phase1\glamos",
    "$ProjectRoot\data\blatten_phase1\swiss_infra",
    "$ProjectRoot\data\blatten_phase1\derived",
    "$ProjectRoot\notebooks",
    "$ProjectRoot\scripts",
    "$ProjectRoot\snap_graphs"
)
foreach ($f in $Folders) {
    if (-not (Test-Path $f)) { New-Item -ItemType Directory -Path $f -Force | Out-Null }
}
Log "Created project directory tree"

# -------------------------
# 6) Verification
# -------------------------
$Checks = @(
    "import sys; print('python', sys.version)",
    "import pandas; print('pandas', pandas.__version__)",
    "import numpy; print('numpy', numpy.__version__)",
    "import geopandas; print('geopandas', geopandas.__version__)",
    "import rasterio; print('rasterio', rasterio.__version__)",
    "import fiona; print('fiona', fiona.__version__)",
    "import asf_search; print('asf_search ok')",
    "import ee; print('earthengine ok')"
)

$Passed = 0
$Failed = 0
foreach ($cmd in $Checks) {
    Log "Running check: $cmd"
    $output = & $CondaExe run -p $EnvPrefix python -c $cmd 2>&1
    $output | Out-File -FilePath $LogFile -Append -Encoding utf8
    if ($LASTEXITCODE -eq 0) {
        Log ">>> OK for: $cmd"
        $Passed++
    } else {
        Log ">>> FAILED for: $cmd"
        $Failed++
    }
}

Log "================ DONE ================="
Log ("Summary: {0} OK, {1} FAILED" -f $Passed, $Failed)
Write-Host ("Summary: {0} OK, {1} FAILED" -f $Passed, $Failed)
Write-Host "Log file: $LogFile"

################################################################################
# setup_blatten_phase1_safe_update.ps1
# Run as Administrator. Safe to re-run. Creates or updates environment.
################################################################################

# -------------------------
# CONFIG
# -------------------------
$CondaRoot   = "D:\miniconda3"
$ProjectRoot = "D:\blatten_project"
$EnvPrefix   = "D:\blatten_project\envs\blatten_phase1"
$EnvYaml     = Join-Path $ProjectRoot "blatten_env.yml"
$LogFile     = Join-Path $ProjectRoot "setup_log_safe_update_log.txt"

# -------------------------
# Helper: logging
# -------------------------
function Log {
    param($s)
    $t = (Get-Date).ToString("s")
    "$t`t$s" | Out-File -FilePath $LogFile -Append -Encoding UTF8
    Write-Host $s
}

# -------------------------
# 0) Admin check
# -------------------------
if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltinRole]::Administrator)) {
    Write-Error "Run PowerShell as Administrator."
    exit 1
}

# -------------------------
# 1) Check Conda
# -------------------------
$CondaExe = Join-Path $CondaRoot "Scripts\conda.exe"
if (-not (Test-Path $CondaExe)) {
    Write-Error "Miniconda not found at $CondaRoot."
    exit 1
}
Log "Miniconda found at $CondaRoot"

# -------------------------
# 2) Create or update environment
# -------------------------
if (Test-Path $EnvPrefix) {
    Log "Environment exists at $EnvPrefix"
} else {
    Log "Environment not found, creating from YAML..."
    & $CondaExe env create -p $EnvPrefix -f $EnvYaml
    if ($LASTEXITCODE -ne 0) { Write-Error "Environment creation failed"; exit 1 }
    Log "Environment created successfully"
}

# -------------------------
# 3) Install/update core packages via Conda
# -------------------------
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

foreach ($pkg in $CondaPkgs) {
    Log "Installing/updating Conda package: $pkg"
    & $CondaExe install -y -p $EnvPrefix -c conda-forge $pkg
    if ($LASTEXITCODE -ne 0) { Log "WARNING: $pkg may have failed to install" }
}

# -------------------------
# 4) Install pip packages
# -------------------------
$PipPkgs = @(
    "earthengine-api",
    "asf-search"
)

foreach ($pkg in $PipPkgs) {
    Log "Installing/updating pip package: $pkg"
    & $CondaExe run -p $EnvPrefix pip install --upgrade $pkg
    if ($LASTEXITCODE -ne 0) { Log "WARNING: pip package $pkg may have failed" }
}

# -------------------------
# 5) Verify environment
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
    $output | Out-File -FilePath $LogFile -Append -Encoding UTF8
    if ($LASTEXITCODE -eq 0) { Log ">>> OK for: $cmd"; $Passed++ } else { Log ">>> FAILED for: $cmd"; $Failed++ }
}

Log "================ DONE ================="
Log ("Summary: {0} OK, {1} FAILED" -f $Passed, $Failed)
Write-Host ("Summary: {0} OK, {1} FAILED" -f $Passed, $Failed)
Write-Host "Log file: $LogFile"

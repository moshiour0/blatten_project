# ==========================================
# setup_blatten_git_folder_with_git.ps1
# One-click setup for GitHub-ready blatten_project folder
# ==========================================

$GitFolder = "D:\blatten_git_folder"
$GitRemote = "https://github.com/moshiour0/blatten_project.git"  # Replace with your repo URL
$InitialCommitMessage = "Initial commit: Project structure and scripts"

# 1. Create folder structure
$Folders = @(
    "$GitFolder\data\blatten_phase1\sentinel1\grd",
    "$GitFolder\data\blatten_phase1\sentinel1\slc",
    "$GitFolder\data\blatten_phase1\sentinel2\l2a",
    "$GitFolder\data\blatten_phase1\glamos",
    "$GitFolder\data\blatten_phase1\swiss_infra",
    "$GitFolder\data\blatten_phase1\derived\grd_outputs",
    "$GitFolder\data\blatten_phase1\derived\s2_resampled",
    "$GitFolder\data\blatten_phase1\derived\s2_quicklooks",
    "$GitFolder\data\blatten_phase1\derived\slc_outputs",
    "$GitFolder\data\blatten_phase1\derived\insar",
    "$GitFolder\notebooks",
    "$GitFolder\scripts",
    "$GitFolder\snap_graphs",
    "$GitFolder\docs"
)

foreach ($f in $Folders) {
    if (-not (Test-Path $f)) {
        New-Item -ItemType Directory -Path $f -Force | Out-Null
    }
}

# 2. Create empty project files
$Files = @(
    "$GitFolder\README.md",
    "$GitFolder\environment.yml",
    "$GitFolder\LICENSE",
    "$GitFolder\manifest.csv",
    "$GitFolder\.gitignore"
)

foreach ($file in $Files) {
    if (-not (Test-Path $file)) {
        New-Item -ItemType File -Path $file | Out-Null
    }
}

# 3. Write a default .gitignore content
$GitignoreContent = @"
# Ignore heavy data
data/blatten_phase1/sentinel1/*
data/blatten_phase1/sentinel2/*
data/blatten_phase1/derived/*
*.dim
*.data
*.tif
*.nc
*.zip

# Python / env
__pycache__/
*.pyc
*.pyo
*.pyd
envs/
*.conda
*.tar.bz2
*.log
*.ipynb_checkpoints

# OS files
.DS_Store
Thumbs.db
"@

Set-Content -Path "$GitFolder\.gitignore" -Value $GitignoreContent

Write-Host "✅ Folder structure and files created at $GitFolder"

# 4. Initialize Git, add remote, and commit
cd $GitFolder

# Check if Git is installed
try {
    git --version | Out-Null
} catch {
    Write-Error "❌ Git is not installed or not in PATH. Please install Git first."
    exit
}

# Initialize repo if not exists
if (-not (Test-Path "$GitFolder\.git")) {
    git init
    Write-Host "✅ Git repository initialized"
}

# Add remote if not exists
$remoteList = git remote
if (-not ($remoteList -contains "origin")) {
    git remote add origin $GitRemote
    Write-Host "✅ Remote origin added: $GitRemote"
}

# Stage all files and commit
git add .
git commit -m $InitialCommitMessage
Write-Host "✅ Initial commit done"

Write-Host "🎉 GitHub-ready folder is ready. You can now push:"
Write-Host "git push -u origin main"

$source = "C:\Users\mirac\Documents\xd"
$backupDir = "C:\Users\mirac\Documents\xd\backups\checkpoint_$(Get-Date -Format 'yyyyMMdd_HHmmss')"

# Create backup directory
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

# Copy all files and directories except the backups directory
Get-ChildItem -Path $source -Exclude 'backups','node_modules','.git' | ForEach-Object {
    $destination = Join-Path $backupDir $_.Name
    if ($_.PSIsContainer) {
        Copy-Item -Path $_.FullName -Destination $destination -Recurse -Force
    } else {
        Copy-Item -Path $_.FullName -Destination $destination -Force
    }
}

Write-Host "Backup completed successfully to: $backupDir"

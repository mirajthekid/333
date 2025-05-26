$filePath = "C:\Users\mirac\Documents\xd\frontend\scripts.js"
$content = [System.IO.File]::ReadAllText($filePath)

# The pattern to search for (the broken template string)
$pattern = 'typingText\.textContent = \$\{data\.username\} is typing\.\.\.'

# The replacement text with proper backticks
$replacement = 'typingText.textContent = `${data.username} is typing...`'

# Perform the replacement
$newContent = $content -replace $pattern, $replacement

# Write the updated content back to the file
[System.IO.File]::WriteAllText($filePath, $newContent)

Write-Host "Template string fixed successfully"

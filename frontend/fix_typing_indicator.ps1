$filePath = "C:\Users\mirac\Documents\xd\frontend\styles.css"
$content = [System.IO.File]::ReadAllText($filePath)

# Add the .active class styling for the typing indicator
$pattern = '\.typing-indicator \{\s*display: none; /\* Hidden by default \*/\s*margin: 0 0 10px 0;\s*padding: 6px 12px;\s*color: var\(--accent-color\);\s*font-size: 10pt;\s*font-style: italic;\s*text-align: left;\s*position: relative;\s*width: fit-content;\s*background-color: rgba\(0, 0, 0, 0\.8\);\s*border-radius: 4px;\s*z-index: 5;\s*box-shadow: 0 0 5px rgba\(0, 170, 255, 0\.3\);\s*pointer-events: none;\s*max-width: 80%;\s*left: 10px;\s*\}'

$replacement = @"
.typing-indicator {
    display: none; /* Hidden by default */
    margin: 0 0 10px 0;
    padding: 6px 12px;
    color: var(--accent-color);
    font-size: 10pt;
    font-style: italic;
    text-align: left;
    position: relative;
    width: fit-content;
    background-color: rgba(0, 0, 0, 0.8);
    border-radius: 4px;
    z-index: 5;
    box-shadow: 0 0 5px rgba(0, 170, 255, 0.3);
    pointer-events: none;
    max-width: 80%;
    left: 10px;
}

/* When active, display the typing indicator */
.typing-indicator.active {
    display: block;
}

/* Ensure typing text is visible */
#typing-text {
    color: var(--accent-color, #00aaff); /* Fallback color if variable not available */
    margin-left: 5px;
}
"@

# Perform the replacement
$newContent = $content -replace $pattern, $replacement

# Write the updated content back to the file
[System.IO.File]::WriteAllText($filePath, $newContent)

Write-Host "Typing indicator styling fixed successfully"

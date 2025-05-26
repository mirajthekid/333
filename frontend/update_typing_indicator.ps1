$filePath = "C:\Users\mirac\Documents\xd\frontend\scripts.js"
$content = [System.IO.File]::ReadAllText($filePath)

# The pattern to search for
$pattern = 'case ''typing'':\s*// Handle typing indicator\s*if \(data\.isTyping\) \{\s*// Show typing indicator with partner''s username\s*typingText\.textContent = \`\$\{partnerUsername\} is typing\.\.\.\`;\s*typingIndicator\.classList\.add\(''active''\);\s*\} else \{\s*// Hide typing indicator\s*typingIndicator\.classList\.remove\(''active''\);\s*\}'

# The replacement text
$replacement = @"
            case 'typing':
                // Handle typing indicator
                console.log('Received typing status:', data);
                if (data.username !== username) {  // Don't show our own typing indicator
                    if (data.isTyping) {
                        // Show typing indicator with partner's username
                        console.log('Showing typing indicator for:', data.username);
                        if (typingText) {
                            typingText.textContent = `${data.username} is typing...`;
                        }
                        if (typingIndicator) {
                            typingIndicator.classList.add('active');
                        }
                    } else {
                        // Hide typing indicator
                        console.log('Hiding typing indicator');
                        if (typingIndicator) {
                            typingIndicator.classList.remove('active');
                        }
                    }
                }
"@

# Perform the replacement
$newContent = $content -replace $pattern, $replacement

# Write the updated content back to the file
[System.IO.File]::WriteAllText($filePath, $newContent)

Write-Host "File updated successfully"

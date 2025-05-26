// Country flag emoji for typeshi.fun
(function() {
    console.log('Country flags feature loaded');
    
    // Simple mapping of country codes to flag emojis (using regional indicator symbols)
    const flagEmojis = {
        'us': '🇺🇸', 'gb': '🇬🇧', 'ca': '🇨🇦', 'au': '🇦🇺', 'de': '🇩🇪',
        'fr': '🇫🇷', 'it': '🇮🇹', 'es': '🇪🇸', 'jp': '🇯🇵', 'kr': '🇰🇷',
        'cn': '🇨🇳', 'in': '🇮🇳', 'br': '🇧🇷', 'ru': '🇷🇺', 'tr': '🇹🇷',
        'sa': '🇸🇦', 'ae': '🇦🇪', 'eg': '🇪🇬', 'za': '🇿🇦', 'ng': '🇳🇬',
        'mx': '🇲🇽', 'ar': '🇦🇷', 'cl': '🇨🇱', 'co': '🇨🇴', 'pe': '🇵🇪',
        've': '🇻🇪', 'nz': '🇳🇿', 'sg': '🇸🇬', 'my': '🇲🇾', 'th': '🇹🇭',
        'id': '🇮🇩', 'ph': '🇵🇭', 'vn': '🇻🇳', 'nl': '🇳🇱', 'be': '🇧🇪',
        'se': '🇸🇪', 'no': '🇳🇴', 'dk': '🇩🇰', 'fi': '🇫🇮', 'pl': '🇵🇱',
        'pt': '🇵🇹', 'gr': '🇬🇷', 'ch': '🇨🇭', 'at': '🇦🇹', 'ie': '🇮🇪',
        'il': '🇮🇱', 'eg': '🇪🇬', 'za': '🇿🇦', 'ke': '🇰🇪', 'ma': '🇲🇦'
    };

    // Cache for country code to avoid multiple API calls
    let userCountryCode = null;
    let countryDetectionInProgress = false;

    // Function to detect user's country using a free API
    async function detectUserCountry() {
        if (userCountryCode) return userCountryCode;
        if (countryDetectionInProgress) return null;
        
        countryDetectionInProgress = true;
        
        try {
            // Try IP-API first (free, no API key needed)
            const response = await fetch('https://ipapi.co/json/');
            if (response.ok) {
                const data = await response.json();
                if (data && data.country_code) {
                    userCountryCode = data.country_code.toLowerCase();
                    console.log('Detected country code (from IP-API):', userCountryCode);
                    return userCountryCode;
                }
            }
            
            // Fallback to ipinfo.io (with a free tier)
            const fallbackResponse = await fetch('https://ipinfo.io/json?token=7b0e3b8f8b8b8b');
            if (fallbackResponse.ok) {
                const data = await fallbackResponse.json();
                if (data && data.country) {
                    userCountryCode = data.country.toLowerCase();
                    console.log('Detected country code (from ipinfo.io):', userCountryCode);
                    return userCountryCode;
                }
            }
            
            // Final fallback to browser language
            const language = navigator.language || navigator.userLanguage || 'en-US';
            const parts = language.split('-');
            userCountryCode = (parts.length > 1 ? parts[1] : 'us').toLowerCase();
            console.log('Falling back to browser language country code:', userCountryCode);
            return userCountryCode;
            
        } catch (error) {
            console.error('Error detecting country:', error);
            return 'us'; // Default to US if all detection methods fail
        } finally {
            countryDetectionInProgress = false;
        }
    }

    // Function to get flag emoji from country code
    function getFlagEmoji(countryCode) {
        if (!countryCode) return '🌐';
        const code = countryCode.toLowerCase();
        return flagEmojis[code] || '🌐';
    }

    // Wait for DOM to be fully loaded
    if (document.readyState === 'complete') {
        addFlags();
    } else {
        window.addEventListener('load', addFlags);
    }

    function addFlags() {
        console.log('Adding country flags...');
        
        // Add CSS for flag display
        const style = document.createElement('style');
        style.textContent = `
            .country-flag {
                display: inline-block;
                margin-left: 5px;
                font-size: 14px;
                line-height: 1;
            }
        `;
        document.head.appendChild(style);

        // Function to add flag to a message
        function addFlagToMessage(message) {
            try {
                const text = message.textContent || '';
                if (!text.includes('You are now chatting with')) return;
                
                console.log('Found chat message:', text);
                
                // Skip if already processed
                if (message.querySelector('.country-flag')) {
                    console.log('Message already has a flag, skipping');
                    return;
                }
                
                // Extract username
                const match = text.match(/You are now chatting with (\w+)/);
                if (!match || !match[1]) {
                    console.log('Could not extract username from:', text);
                    return;
                }
                
                const username = match[1];
                console.log('Found username:', username);
                
                // Get user's country code (async)
                let countryCode = 'us'; // Default
                
                // Try to get country code
                detectUserCountry().then(code => {
                    if (code) {
                        countryCode = code;
                        const flag = getFlagEmoji(countryCode);
                        console.log(`Detected country: ${countryCode.toUpperCase()}, adding flag: ${flag}`);
                        
                        // Update the message with the flag
                        const flagSpan = document.createElement('span');
                        flagSpan.className = 'country-flag';
                        flagSpan.textContent = flag;
                        flagSpan.title = countryCode.toUpperCase();
                        
                        // Replace the username with username + flag
                        message.innerHTML = text.replace(
                            new RegExp(`(${username})(?![^<]*>|[^<>]*<\/span>)`, 'i'), 
                            `$1${flagSpan.outerHTML}`
                        );
                    }
                }).catch(console.error);
                
                // Use default flag immediately (will be updated if detection succeeds)
                const flag = getFlagEmoji(countryCode);
                
                // Create flag element
                const flagSpan = document.createElement('span');
                flagSpan.className = 'country-flag';
                flagSpan.textContent = flag;
                flagSpan.title = countryCode.toUpperCase();
                
                // Replace the username with username + flag (more precise matching)
                message.innerHTML = text.replace(
                    new RegExp(`(${username})(?![^<]*>|[^<>]*<\/span>)`, 'i'), 
                    `$1${flagSpan.outerHTML}`
                );
                
                console.log('Updated message HTML:', message.innerHTML);
                
            } catch (error) {
                console.error('Error adding flag to message:', error);
            }
        }

        // Process existing chat messages
        function processExistingMessages() {
            console.log('Processing existing messages...');
            const messages = document.querySelectorAll('.message.system');
            console.log(`Found ${messages.length} system messages`);
            messages.forEach(addFlagToMessage);
        }

        // Watch for new messages
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes) {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1 && 
                            node.classList && 
                            node.classList.contains('message') && 
                            node.classList.contains('system')) {
                            addFlagToMessage(node);
                        }
                    });
                }
            });
        });

        // Start observing
        const chatContainer = document.querySelector('.chat-messages');
        if (chatContainer) {
            console.log('Setting up mutation observer on chat container');
            observer.observe(chatContainer, { childList: true, subtree: true });
            
            // Process existing messages
            processExistingMessages();
            
            // Also check periodically
            const checkInterval = setInterval(() => {
                if (!document.body.contains(chatContainer)) {
                    clearInterval(checkInterval);
                    return;
                }
                processExistingMessages();
            }, 2000);
        } else {
            console.error('Could not find chat messages container');
        }
    }
})();

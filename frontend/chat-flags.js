// Simple country flags for chat system

// Map of country codes to flag emojis
const countryFlags = {
    'US': '🇺🇸', 'GB': '🇬🇧', 'DE': '🇩🇪', 'FR': '🇫🇷', 'IT': '🇮🇹', 'ES': '🇪🇸',
    'TR': '🇹🇷', 'RU': '🇷🇺', 'JP': '🇯🇵', 'KR': '🇰🇷', 'CN': '🇨🇳', 'IN': '🇮🇳',
    'BR': '🇧🇷', 'CA': '🇨🇦', 'AU': '🇦🇺', 'NZ': '🇳🇿', 'MX': '🇲🇽', 'AR': '🇦🇷',
    'CL': '🇨🇱', 'CO': '🇨🇴', 'PE': '🇵🇪', 'VE': '🇻🇪', 'ZA': '🇿🇦', 'EG': '🇪🇬',
    'MA': '🇲🇦', 'NG': '🇳🇬', 'KE': '🇰🇪', 'SA': '🇸🇦', 'AE': '🇦🇪', 'IL': '🇮🇱',
    'IR': '🇮🇷', 'PK': '🇵🇰', 'AF': '🇦🇫', 'BD': '🇧🇩', 'TH': '🇹🇭', 'VN': '🇻🇳',
    'ID': '🇮🇩', 'MY': '🇲🇾', 'PH': '🇵🇭', 'SG': '🇸🇬'
};

// Get country flag emoji from country code
function getCountryFlag(countryCode) {
    return countryFlags[countryCode?.toUpperCase()] || '🌍';
}

// Function to update chat partner's country based on IP
async function updatePartnerCountry(ip) {
    try {
        const response = await fetch(`https://ipapi.co/${ip}/json/`);
        const data = await response.json();
        if (data.country_code) {
            const countryCode = data.country_code.toUpperCase();
            const flag = countryFlags[countryCode] || '🌍';
            
            // Find and update the system message
            const systemMsg = Array.from(document.querySelectorAll('.message.system'))
                .find(msg => msg.textContent.includes('You are now chatting with'));
                
            if (systemMsg) {
                const username = systemMsg.textContent.split('You are now chatting with ')[1]
                    .replace(/[\u{1F1E6}-\u{1F1FF}]{2}|\p{Emoji}/gu, '')
                    .trim();
                systemMsg.textContent = `You are now chatting with ${username} ${flag}`;
            }
        }
    } catch (error) {
        console.error('Error fetching country:', error);
    }
}

// Function to update system message with flag
function updateSystemMessage(flag) {
    const messages = document.querySelectorAll('.message.system');
    messages.forEach(msg => {
        if (msg.textContent.includes('You are now chatting with')) {
            const username = msg.textContent.split('You are now chatting with ')[1].trim();
            // Remove any existing flags first
            const cleanUsername = username.replace(/[\u{1F1E6}-\u{1F1FF}]{2}|\p{Emoji}/gu, '').trim();
            msg.textContent = `You are now chatting with ${cleanUsername} ${flag}`;
        }
    });
}

// Function to process all messages and add flags
function processMessages() {
    const messages = document.querySelectorAll('.message.incoming');
    messages.forEach(addFlagToMessage);
}

// Observe chat messages for new additions
const chatObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1 && node.classList.contains('message')) {
                addFlagToMessage(node);
            }
        });
    });
});

// Start observing chat messages
document.addEventListener('DOMContentLoaded', () => {
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) {
        chatObserver.observe(chatMessages, { childList: true, subtree: true });
    }
});

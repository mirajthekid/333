// country-flags.js - New Version
console.log('Country flags script loaded - New Version');

/**
 * Creates an image element for a country flag.
 * @param {string} countryCode - The two-letter country code (e.g., 'US', 'GB').
 * @returns {HTMLImageElement|null} - The image element or null if countryCode is invalid.
 */
function createCountryFlagElement(countryCode) {
    if (!countryCode || typeof countryCode !== 'string' || countryCode.length !== 2) {
        console.warn('Invalid country code for flag:', countryCode);
        return null;
    }
    const flagImg = document.createElement('img');
    flagImg.src = `https://flagcdn.com/24x18/${countryCode.toLowerCase()}.png`;
    flagImg.alt = countryCode.toUpperCase(); // Alt text for accessibility
    flagImg.title = `Country: ${countryCode.toUpperCase()}`; // Tooltip
    flagImg.className = 'country-flag'; // Apply CSS class for styling

    // Optional: Add inline styles for consistent sizing if CSS isn't sufficient,
    // though it's generally better to control this with CSS.
    // The existing styles.css and inline styles from the original script might cover this.
    flagImg.style.width = '20px'; // Example size, adjust as needed or control via CSS
    flagImg.style.height = '15px';// Example size, adjust as needed

    return flagImg;
}

// (Optional) Function to detect the local user's country.
// This might be useful for sending the local user's country to the backend,
// or for displaying their own flag somewhere if needed.
// For displaying the PARTNER'S flag, the backend MUST send the partner's country code.
async function detectLocalUserCountry() {
    try {
        console.log('Detecting local user country...');
        const response = await fetch('https://ipapi.co/json/');
        if (!response.ok) throw new Error('Failed to fetch location data');
        
        const data = await response.json();
        console.log('Local IP Geolocation data:', data);
        
        const localCountryCode = data.country_code ? data.country_code.toLowerCase() : 'unknown';
        console.log('Local user country code set to:', localCountryCode);
        // You could store this globally if needed, e.g., window.localUserCountryCode = localCountryCode;
        return localCountryCode;
    } catch (error) {
        console.error('Error detecting local user country:', error);
        return 'unknown'; // Default on error
    }
}

// Example of initializing local country detection if you need it:
// document.addEventListener('DOMContentLoaded', () => {
//     detectLocalUserCountry().then(code => {
//         console.log("Local user's country detected as:", code);
//     });
// });
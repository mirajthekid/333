// Simple geolocation service to determine country from IP address
const https = require('https');

// Map of country codes to flag emojis
const countryToFlag = {
  'US': '🇺🇸', // United States
  'GB': '🇬🇧', // United Kingdom
  'CA': '🇨🇦', // Canada
  'AU': '🇦🇺', // Australia
  'DE': '🇩🇪', // Germany
  'FR': '🇫🇷', // France
  'JP': '🇯🇵', // Japan
  'CN': '🇨🇳', // China
  'BR': '🇧🇷', // Brazil
  'IN': '🇮🇳', // India
  'RU': '🇷🇺', // Russia
  'IT': '🇮🇹', // Italy
  'ES': '🇪🇸', // Spain
  'MX': '🇲🇽', // Mexico
  'KR': '🇰🇷', // South Korea
  // Add more countries as needed
};

// Default flag for unknown countries
const DEFAULT_FLAG = '🌐';

// Function to get country flag emoji from IP address
async function getCountryFlag(ip) {
  // For local development, always return US flag for testing
  if (ip === '127.0.0.1' || ip === 'localhost' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('::1') || ip.startsWith('::ffff:')) {
    console.log(`Assigned US flag 🇺🇸 for local IP ${ip}`);
    return '🇺🇸'; // US flag for consistent testing
  }
  
  // Use a free IP geolocation API
  return new Promise((resolve) => {
    https.get(`https://ipapi.co/${ip}/json/`, (resp) => {
      let data = '';
      
      resp.on('data', (chunk) => {
        data += chunk;
      });
      
      resp.on('end', () => {
        try {
          const response = JSON.parse(data);
          const countryCode = response.country_code;
          
          if (countryCode && countryToFlag[countryCode]) {
            resolve(countryToFlag[countryCode]);
          } else {
            resolve(DEFAULT_FLAG);
          }
        } catch (error) {
          console.error('Error parsing geolocation data:', error);
          resolve(DEFAULT_FLAG);
        }
      });
    }).on('error', (error) => {
      console.error('Error fetching geolocation data:', error);
      resolve(DEFAULT_FLAG);
    });
  });
}

module.exports = {
  getCountryFlag
};

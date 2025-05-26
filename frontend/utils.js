/**
 * Minimal security utility functions for the frontend
 * Simplified to avoid affecting styling
 */

/**
 * Safely parse JSON with error handling
 * @param {string} jsonString - JSON string to parse
 * @param {*} defaultValue - Default value to return if parsing fails
 * @returns {*} - Parsed JSON or default value
 */
function safeJsonParse(jsonString, defaultValue = {}) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Error parsing JSON');
    return defaultValue;
  }
}

// Export minimal functions for use in other scripts
window.utils = {
  safeJsonParse
};

/**
 * Utility functions for input sanitization and validation
 */

// Regular expression for validating usernames
const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,20}$/;

/**
 * Sanitize a username to prevent injection attacks
 * @param {string} username - The username to sanitize
 * @returns {Object} - Object containing sanitized username and validation status
 */
function sanitizeUsername(username) {
  if (!username || typeof username !== 'string') {
    return { 
      isValid: false, 
      sanitized: '', 
      error: 'Username must be a non-empty string' 
    };
  }

  // Trim whitespace
  const trimmed = username.trim();
  
  // Check length
  if (trimmed.length < 3 || trimmed.length > 20) {
    return { 
      isValid: false, 
      sanitized: trimmed, 
      error: 'Username must be between 3 and 20 characters' 
    };
  }
  
  // Check for valid characters
  if (!USERNAME_REGEX.test(trimmed)) {
    return { 
      isValid: false, 
      sanitized: trimmed, 
      error: 'Username can only contain letters, numbers, underscores, and hyphens' 
    };
  }
  
  return { 
    isValid: true, 
    sanitized: trimmed, 
    error: null 
  };
}

/**
 * Sanitize a chat message to prevent XSS attacks
 * @param {string} message - The message to sanitize
 * @returns {Object} - Object containing sanitized message and validation status
 */
function sanitizeMessage(message) {
  if (!message || typeof message !== 'string') {
    return { 
      isValid: false, 
      sanitized: '', 
      error: 'Message must be a non-empty string' 
    };
  }

  // Trim whitespace
  const trimmed = message.trim();
  
  // Check length
  if (trimmed.length === 0) {
    return { 
      isValid: false, 
      sanitized: '', 
      error: 'Message cannot be empty' 
    };
  }
  
  if (trimmed.length > 2000) {
    return { 
      isValid: false, 
      sanitized: trimmed.substring(0, 2000), 
      error: 'Message exceeds maximum length of 2000 characters' 
    };
  }
  
  // Escape HTML special characters to prevent XSS
  const sanitized = trimmed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  
  return { 
    isValid: true, 
    sanitized: sanitized, 
    error: null 
  };
}

module.exports = {
  sanitizeUsername,
  sanitizeMessage,
  USERNAME_REGEX
};

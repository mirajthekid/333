/**
 * Swipe-to-Skip Feature
 * Allows users to swipe the chat window left to trigger the skip function
 */

document.addEventListener('DOMContentLoaded', function() {
    // Variables to track touch/swipe
    let touchStartX = 0;
    let touchEndX = 0;
    let minSwipeDistance = 100; // Minimum distance required for a swipe (in pixels)
    
    // Get the chat screen element
    const chatScreen = document.getElementById('chat-screen');
    
    // Function to handle the skip action
    function handleSkip() {
        // Get the skip button and trigger a click if it exists
        const skipBtn = document.getElementById('skip-btn');
        if (skipBtn) {
            skipBtn.click();
        }
    }
    
    // Add touch event listeners to the chat screen
    if (chatScreen) {
        // Touch start event
        chatScreen.addEventListener('touchstart', function(e) {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });
        
        // Touch end event
        chatScreen.addEventListener('touchend', function(e) {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        }, { passive: true });
        
        // Mouse events for desktop testing
        let isMouseDown = false;
        
        chatScreen.addEventListener('mousedown', function(e) {
            isMouseDown = true;
            touchStartX = e.screenX;
        });
        
        chatScreen.addEventListener('mouseup', function(e) {
            if (isMouseDown) {
                touchEndX = e.screenX;
                handleSwipe();
                isMouseDown = false;
            }
        });
        
        // Cancel mouse tracking if mouse leaves the element
        chatScreen.addEventListener('mouseleave', function() {
            isMouseDown = false;
        });
    }
    
    // Function to handle the swipe gesture
    function handleSwipe() {
        const swipeDistance = touchStartX - touchEndX;
        
        // If swiped left with enough distance, trigger skip
        if (swipeDistance > minSwipeDistance) {
            handleSkip();
            
            // Visual feedback for swipe (optional)
            chatScreen.classList.add('swiping-left');
            setTimeout(() => {
                chatScreen.classList.remove('swiping-left');
            }, 300);
        }
    }
});

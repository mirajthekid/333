const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const path = require('path');
const { sanitizeUsername, sanitizeMessage } = require('./utils/sanitize');
const axios = require('axios');
require('dotenv').config();

// Initialize express app
const app = express();

// Visitor stats
let visitorCount = 0;
// let countryStats = {}; // This was part of visitor stats, might not be needed if dailyVisits tracks countries
const SECRET_KEY = process.env.VISITOR_COUNTER_KEY || 'your-secret-key';
const IPINFO_TOKEN = process.env.IPINFO_TOKEN;

// Configure CORS for production - more restrictive
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? (process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['https://xd-chat.onrender.com']) 
    : 'http://localhost:3000', // Allow localhost for development
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
app.use(express.json());

// Serve static files from the public directory (for landing page, terms, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// Serve frontend files from the frontend directory for /chat path
app.use('/chat', express.static(path.join(__dirname, '../frontend')));


// Add headers for WebSocket support (though wss library handles upgrade, this is good practice for HTTP part)
app.use((req, res, next) => {
  // Adjust origin based on environment or specific needs
  const origin = process.env.NODE_ENV === 'production' 
    ? (process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',')[0] : 'https://xd-chat.onrender.com') 
    : 'http://localhost:3000';
  res.header('Access-Control-Allow-Origin', origin); 
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});


// Track daily visits
const dailyVisits = new Map(); // Stores date -> { count, countryStats }

// Middleware to track visitors and their countries
app.use(async (req, res, next) => {
  const isPageView = req.path === '/' || req.path.startsWith('/chat'); // Track root and /chat paths
  
  if (isPageView) {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    // Skip counting for specific IPs (e.g., your own dev IP)
    const skipIPs = (process.env.SKIP_TRACKING_IPS || '142.112.216.34,::1,127.0.0.1').split(',');
    if (clientIp && skipIPs.some(skipIp => clientIp.includes(skipIp))) {
      return next();
    }
    
    const today = new Date().toISOString().split('T')[0];
    if (!dailyVisits.has(today)) {
      dailyVisits.set(today, { count: 0, countryStats: {} });
    }
    
    const todayStats = dailyVisits.get(today);
    todayStats.count++;
    visitorCount++; // Overall count
    
    if (IPINFO_TOKEN && clientIp) {
      try {
        let cleanIp = clientIp;
        if (cleanIp.includes(',')) cleanIp = cleanIp.split(',')[0].trim();
        if (cleanIp.startsWith('::ffff:')) cleanIp = cleanIp.replace('::ffff:', '');
        
        if (!skipIPs.some(skipIp => cleanIp.includes(skipIp))) { // Check cleaned IP too
          const url = `https://ipinfo.io/${cleanIp}/json?token=${IPINFO_TOKEN}`;
          const response = await axios.get(url, { timeout: 2000 });
          if (response.data && response.data.country) {
            const country = response.data.country.toUpperCase();
            todayStats.countryStats[country] = (todayStats.countryStats[country] || 0) + 1;
          }
        }
      } catch (error) {
        console.error('Error getting country info for visitor stats:', error.message);
      }
    }
  }
  next();
});

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket server
const wss = new WebSocket.Server({ 
  server,
  perMessageDeflate: {
    zlibDeflateOptions: { chunkSize: 1024, memLevel: 7, level: 3 },
    zlibInflateOptions: { chunkSize: 10 * 1024 },
    concurrencyLimit: 10,
    threshold: 1024
  }
});

// In-memory data structures
const waitingUsers = []; 
const activeRooms = new Map(); 
const userConnections = new Map(); 
const userSockets = new Map(); 

// Rate limiting
const messageRateLimits = new Map();
const connectionRateLimits = new Map();
const MAX_MESSAGES_PER_MINUTE = 30; 
const MAX_CONNECTIONS_PER_MINUTE_PER_IP = 10; // Renamed for clarity

// Security
const MAX_MESSAGE_SIZE = 16 * 1024; // 16KB

// Helper function to get country code from IP
async function getCountryCodeFromIp(ip) {
    if (!IPINFO_TOKEN || !ip || ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
        console.log(`IP ${ip} is local or IPINFO_TOKEN is missing. Assigning 'XX'.`);
        return 'XX';
    }
    try {
        let cleanIp = ip;
        if (cleanIp.includes(',')) {
            cleanIp = cleanIp.split(',')[0].trim();
        }
        if (cleanIp.startsWith('::ffff:')) {
            cleanIp = cleanIp.replace('::ffff:', '');
        }

        if (cleanIp === '::1' || cleanIp === '127.0.0.1') { // Check again after cleaning
             console.log(`Cleaned IP ${cleanIp} is local. Assigning 'XX'.`);
             return 'XX';
        }

        const url = `https://ipinfo.io/${cleanIp}/json?token=${IPINFO_TOKEN}`;
        console.log(`Workspaceing country for IP: ${cleanIp} from ${url}`);
        const response = await axios.get(url, { timeout: 2500 }); // Slightly longer timeout
        if (response.data && response.data.country) {
            console.log(`Country for IP ${cleanIp}: ${response.data.country.toUpperCase()}`);
            return response.data.country.toUpperCase();
        }
        console.log(`No country data for IP ${cleanIp}. Assigning 'XX'. Response:`, response.data);
        return 'XX';
    } catch (error) {
        console.error(`Error getting country code for IP ${ip} (Cleaned: ${ip}):`, error.message);
        if (error.response) {
            console.error("IPInfo Response Error Data:", error.response.data);
            console.error("IPInfo Response Error Status:", error.response.status);
        }
        return 'XX'; 
    }
}


function broadcastOnlineCount() {
  let totalConnectedClients = 0;
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      totalConnectedClients++;
    }
  });
  
  const message = JSON.stringify({ type: 'online_count', count: totalConnectedClients });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try { client.send(message); } catch (e) { console.error("Error broadcasting online count:", e); }
    }
  });
  console.log(`Broadcasting online count: ${totalConnectedClients} clients`);
}

setInterval(() => {
  if (waitingUsers.length >= 2) {
    console.log('Running periodic matchmaking check...');
    matchUsers();
  }
}, 5000);

setInterval(broadcastOnlineCount, 10000);

setInterval(() => {
  console.log('Cleaning up inactive connections...');
  userConnections.forEach((ws, userId) => {
    if (ws.readyState !== WebSocket.OPEN && ws.readyState !== WebSocket.CONNECTING) {
      console.log(`Cleaning up stale connection for user ${userId}`);
      userConnections.delete(userId);
      const waitingIndex = waitingUsers.findIndex(u => u.id === userId);
      if (waitingIndex !== -1) {
        waitingUsers.splice(waitingIndex, 1);
        console.log(`Removed stale user ${userId} from waiting queue`);
      }
      // Also remove from userSockets if the ws object is the key
      for (let [socket, id] of userSockets.entries()) {
        if (id === userId) {
          userSockets.delete(socket);
          break;
        }
      }
    }
  });
  // Clean up userSockets map for any closed WebSockets
   userSockets.forEach((userId, ws) => {
    if (ws.readyState !== WebSocket.OPEN && ws.readyState !== WebSocket.CONNECTING) {
        userSockets.delete(ws);
        console.log(`Cleaned userSocket mapping for disconnected client previously associated with ${userId}`);
    }
  });


}, 30000);


function matchUsers() {
  console.log(`Attempting to match users. Current queue size: ${waitingUsers.length}`);
  
  const activeWaitingUsers = waitingUsers.filter(user => {
    const conn = userConnections.get(user.id);
    return conn && conn.readyState === WebSocket.OPEN;
  });
  
  if (waitingUsers.length !== activeWaitingUsers.length) {
      console.log(`Updating waiting queue. Original: ${waitingUsers.length}, Active: ${activeWaitingUsers.length}`);
      waitingUsers.length = 0;
      waitingUsers.push(...activeWaitingUsers);
  }
  
  if (waitingUsers.length >= 2) {
    const user1 = waitingUsers.shift();
    const user2 = waitingUsers.shift();
    
    console.log(`Matching ${user1.username} (Country: ${user1.countryCode}) with ${user2.username} (Country: ${user2.countryCode})`);
    
    const roomId = uuidv4();
    activeRooms.set(roomId, {
      id: roomId,
      users: [user1, user2],
      createdAt: Date.now()
    });
    
    const user1Connection = userConnections.get(user1.id);
    const user2Connection = userConnections.get(user2.id);
    
    if (user1Connection && user1Connection.readyState === WebSocket.OPEN) {
      try {
        user1Connection.send(JSON.stringify({
          type: 'matched',
          roomId: roomId,
          partner: user2.username,
          partnerCountry: user2.countryCode || 'XX' // Send partner's country
        }));
      } catch (e) { console.error("Error sending match to user1:", e); }
    }
    
    if (user2Connection && user2Connection.readyState === WebSocket.OPEN) {
      try {
        user2Connection.send(JSON.stringify({
          type: 'matched',
          roomId: roomId,
          partner: user1.username,
          partnerCountry: user1.countryCode || 'XX' // Send partner's country
        }));
      } catch (e) { console.error("Error sending match to user2:", e); }
    }
    console.log(`Successfully matched users: ${user1.username} and ${user2.username} in room ${roomId}`);
  } else {
    console.log('Not enough active users in queue to match yet');
  }
}

wss.on('connection', (ws, req) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  console.log(`New client connected from ${clientIp}. Protocol: ${ws.protocol}`);
  
  if (isConnectionRateLimited(clientIp)) {
    console.log(`Connection rate limit exceeded for IP: ${clientIp}`);
    try { ws.send(JSON.stringify({ type: 'error', message: 'Too many connection attempts.' })); } catch(e){}
    ws.close();
    return;
  }
  
  const userId = uuidv4();
  userSockets.set(ws, userId); // Map WebSocket to userId for cleanup on close

  broadcastOnlineCount();
  
  ws.on('message', async (message) => { // Made this async to await getCountryCodeFromIp
    try {
      if (message.length > MAX_MESSAGE_SIZE) {
        console.log(`Message size limit exceeded: ${message.length} bytes`);
        try { ws.send(JSON.stringify({ type: 'error', message: 'Message too large.' })); } catch(e){}
        return;
      }
      
      const data = JSON.parse(message);
      const currentUserId = userSockets.get(ws); // Get userId associated with this ws connection

      if (!currentUserId) {
          console.error("Could not find userId for ws connection. Closing.");
          ws.close();
          return;
      }
      
      switch (data.type) {
        case 'login':
          const usernameResult = sanitizeUsername(data.username);
          if (!usernameResult.isValid) {
            try { ws.send(JSON.stringify({ type: 'login_error', message: usernameResult.error })); } catch(e){}
            return;
          }
          const username = usernameResult.sanitized;
          
          // Ensure this user isn't already logged in or in the waiting queue with the same userId
          if (userConnections.has(currentUserId) || waitingUsers.some(u => u.id === currentUserId)) {
              console.log(`User ${username} (${currentUserId}) attempted to log in again.`);
              // Optionally send an error or just ignore
              try { ws.send(JSON.stringify({ type: 'login_error', message: 'Already logged in or in queue.' })); } catch(e){}
              return;
          }

          const countryCode = await getCountryCodeFromIp(clientIp);
          
          userConnections.set(currentUserId, ws); // Store WebSocket against userId
          const user = {
            id: currentUserId,
            username: username,
            joinedAt: Date.now(),
            countryCode: countryCode 
          };
          waitingUsers.push(user);
          
          try { 
            ws.send(JSON.stringify({ 
              type: 'login_success', 
              userId: currentUserId, 
              username: username, // Send username back for confirmation/display
              countryCode: countryCode // Send their own country code
            })); 
          } catch(e){ console.error("Error sending login_success:", e); }
          
          console.log(`User ${username} (${currentUserId}) from ${countryCode} logged in and added to queue`);
          broadcastOnlineCount();
          setTimeout(() => matchUsers(), 500);
          break;
          
        case 'cancel_search':
          const userToCancelId = userSockets.get(ws);
          if (userToCancelId) {
            const waitingIndex = waitingUsers.findIndex(u => u.id === userToCancelId);
            if (waitingIndex !== -1) {
              waitingUsers.splice(waitingIndex, 1);
              console.log(`User ${userToCancelId} (${data.username || 'Unknown'}) removed from waiting queue by cancel_search.`);
            }
            // Do not remove from userConnections here, as they might log in again.
            // Let the 'close' event handle full cleanup.
          }
          break;
          
        case 'message':
          const senderId = userSockets.get(ws);
          if (!senderId) break; 

          if (isMessageRateLimited(senderId)) {
            console.log(`Message rate limit exceeded for user: ${senderId}`);
            try { ws.send(JSON.stringify({ type: 'error', message: 'Sending messages too quickly.' })); } catch(e){}
            return;
          }
          
          const messageResult = sanitizeMessage(data.content);
          if (!messageResult.isValid) {
            try { ws.send(JSON.stringify({ type: 'error', message: messageResult.error })); } catch(e){}
            return;
          }
          trackMessage(senderId);
          
          let targetRoomMsg = null;
          let targetUserMsg = null;
          activeRooms.forEach((room) => {
            if (room.users.some(u => u.id === senderId)) {
              targetRoomMsg = room;
              targetUserMsg = room.users.find(u => u.id !== senderId);
            }
          });
          
          if (targetRoomMsg && targetUserMsg) {
            const targetConnection = userConnections.get(targetUserMsg.id);
            if (targetConnection && targetConnection.readyState === WebSocket.OPEN) {
              try {
                targetConnection.send(JSON.stringify({
                  type: 'message',
                  content: messageResult.sanitized,
                  sender: data.username, // Username from client message
                  timestamp: Date.now()
                }));
              } catch(e) { console.error("Error sending message to target:", e); }
            }
          }
          break;
          
        case 'typing':
          const typerId = userSockets.get(ws);
          if(!typerId) break;

          console.log(`Typing event from ${typerId} (${data.username}), isTyping: ${data.isTyping}, roomId: ${data.roomId}`);
          let typingTargetRoom = data.roomId && activeRooms.has(data.roomId) ? activeRooms.get(data.roomId) : null;
          
          if (!typingTargetRoom) {
            activeRooms.forEach((room) => {
              if (room.users.some(u => u.id === typerId)) {
                typingTargetRoom = room;
              }
            });
          }

          if (typingTargetRoom) {
            const typingTargetPartner = typingTargetRoom.users.find(u => u.id !== typerId);
            if (typingTargetPartner) {
              console.log(`Found partner for typing: ${typingTargetPartner.username} (${typingTargetPartner.id})`);
              const partnerConnectionTyping = userConnections.get(typingTargetPartner.id);
              if (partnerConnectionTyping && partnerConnectionTyping.readyState === WebSocket.OPEN) {
                try {
                  partnerConnectionTyping.send(JSON.stringify({
                    type: 'typing',
                    isTyping: data.isTyping,
                    username: data.username // Username of the typer
                  }));
                  console.log(`Sent typing to ${typingTargetPartner.username}`);
                } catch(e) { console.error("Error sending typing status:", e); }
              } else { console.log("Partner for typing not connected or connection not open."); }
            } else { console.log("No partner found in room for typing event.");}
          } else { console.log(`No room found for typing event from user ${typerId}`); }
          break;
          
        case 'skip_notification': // Client informs server they initiated skip UI
            const notifierId = userSockets.get(ws);
            if (!notifierId) break;
            console.log(`Skip notification received from ${notifierId} (${data.username}), in room ${data.roomId}`);
            let roomForSkipNotification = data.roomId && activeRooms.has(data.roomId) ? activeRooms.get(data.roomId) : null;

            if (!roomForSkipNotification) {
                 activeRooms.forEach((room) => {
                    if (room.users.some(u => u.id === notifierId)) roomForSkipNotification = room;
                });
            }

            if (roomForSkipNotification) {
                const partnerToNotifySkip = roomForSkipNotification.users.find(u => u.id !== notifierId);
                if (partnerToNotifySkip) {
                    const conn = userConnections.get(partnerToNotifySkip.id);
                    if (conn && conn.readyState === WebSocket.OPEN) {
                        try {
                            conn.send(JSON.stringify({
                                type: 'partner_skipped', // Let client know partner initiated skip sequence
                                message: `${data.username || 'Your partner'} initiated skip protocol.`,
                                username: data.username 
                            }));
                            console.log(`Sent 'partner_skipped' (due to notification) to ${partnerToNotifySkip.username}`);
                        } catch(e) { console.error("Error sending partner_skipped notification:", e); }
                    }
                }
            }
            break;

        case 'skip': // User confirms skip after countdown
          const skipperId = userSockets.get(ws);
          if (!skipperId) break;
          console.log(`User ${skipperId} (${data.username}) confirmed skip for room ${data.roomId}`);
          
          let roomToCloseId = data.roomId && activeRooms.has(data.roomId) ? data.roomId : null;
          let roomToCloseObj = roomToCloseId ? activeRooms.get(roomToCloseId) : null;

          if (!roomToCloseObj) {
            activeRooms.forEach((room, rId) => {
              if (room.users.some(u => u.id === skipperId)) {
                roomToCloseId = rId;
                roomToCloseObj = room;
              }
            });
          }
          
          if (roomToCloseObj) {
            const partnerOnSkip = roomToCloseObj.users.find(u => u.id !== skipperId);
            activeRooms.delete(roomToCloseId); // Remove room
            console.log(`Room ${roomToCloseId} removed after skip by ${data.username}.`);

            // Handle skipper: add back to waiting queue
            const skipperUserObj = roomToCloseObj.users.find(u => u.id === skipperId);
            if (skipperUserObj) {
                 // Remove from any existing queue first to prevent duplicates
                const skipperWaitingIndex = waitingUsers.findIndex(u => u.id === skipperId);
                if (skipperWaitingIndex !== -1) waitingUsers.splice(skipperWaitingIndex, 1);
                
                waitingUsers.push(skipperUserObj); // Add skipper back to queue
                console.log(`User ${skipperUserObj.username} added back to waiting queue after skipping.`);
            }

            // Handle partner: notify and add back to waiting queue
            if (partnerOnSkip) {
              const partnerConnSkip = userConnections.get(partnerOnSkip.id);
              if (partnerConnSkip && partnerConnSkip.readyState === WebSocket.OPEN) {
                try {
                  partnerConnSkip.send(JSON.stringify({
                    type: 'partner_disconnected', // Or a more specific "partner_has_skipped"
                    message: `${data.username || 'Your partner'} has left the chat.`
                  }));
                   console.log(`Notified ${partnerOnSkip.username} that ${data.username} skipped.`);
                } catch(e) { console.error("Error notifying partner of skip:", e); }

                // Remove from any existing queue first
                const partnerWaitingIndex = waitingUsers.findIndex(u => u.id === partnerOnSkip.id);
                if (partnerWaitingIndex !== -1) waitingUsers.splice(partnerWaitingIndex, 1);

                waitingUsers.push(partnerOnSkip); // Add partner back to queue
                console.log(`User ${partnerOnSkip.username} added back to waiting queue after partner skipped.`);
              }
            }
            setTimeout(() => matchUsers(), 1000); // Try to match again
          } else {
            console.log(`Skip request from ${skipperId} (${data.username}) but no active room ${data.roomId} found.`);
            // If no room, but user wants to skip, effectively put them in queue if not already
            const skipperUserFromSockets = userSockets.get(ws); // this is skipperId
            const userObjFromConnections = Array.from(userConnections.keys()).find(uid => uid === skipperId); // This isn't how to get the user object
            
            // Find the user object if they are known
            let userToRequeue = waitingUsers.find(u => u.id === skipperId);
            if (!userToRequeue) { // If not in waiting, maybe they were in a room that just vanished, or error
                 // Attempt to find user details if they are connected but not in waiting
                const userConn = userConnections.get(skipperId);
                if (userConn) { // User is connected
                     // We need their username and countryCode.
                     // This information is established at login. If they are skipping without a room,
                     // they are effectively asking to be put back into the queue.
                     // We need a reliable way to get their full user object.
                     // Simplest: if we can't find their full object, and they send 'skip',
                     // it might imply they want to re-queue.
                     // For now, if they are not in a room and send skip, we just try matchmaking.
                     console.log(`User ${data.username} (${skipperId}) sent skip but was not in a clear room. Attempting to match.`);
                }
            }
             setTimeout(() => matchUsers(), 1000);

          }
          break;
          
        case 'report':
          const reporterId = userSockets.get(ws);
          if (!reporterId) break;
          console.log(`User ${data.reportingUser} (${reporterId}) reported: ${data.reportedUser} in room ${data.roomId}`);
          try { ws.send(JSON.stringify({ type: 'report_acknowledged', message: 'Report received. Thank you.' })); } catch(e){}
          break;
      }
    } catch (error) {
      console.error('Error processing message:', error, message);
      try { ws.send(JSON.stringify({ type: 'error', message: 'Error processing your request.' })); } catch(e){}
    }
  });
  
  ws.on('close', () => {
    const closedUserId = userSockets.get(ws); // Get userId using the ws object
    console.log(`Client disconnected: UserID ${closedUserId || 'unknown'}`);
    
    if (closedUserId) {
      userConnections.delete(closedUserId);
      userSockets.delete(ws); // Remove from this map too
      
      const waitingIndex = waitingUsers.findIndex(u => u.id === closedUserId);
      if (waitingIndex !== -1) {
        const removedUser = waitingUsers.splice(waitingIndex, 1);
        console.log(`Removed disconnected user ${removedUser[0]?.username || closedUserId} from waiting queue`);
      }
      
      let roomToCloseOnDisconnect = null;
      let partnerToNotifyOnDisconnect = null;
      let disconnectedUserObj = null;

      activeRooms.forEach((room, roomId) => {
        const userInRoom = room.users.find(u => u.id === closedUserId);
        if (userInRoom) {
          roomToCloseOnDisconnect = roomId;
          disconnectedUserObj = userInRoom;
          partnerToNotifyOnDisconnect = room.users.find(u => u.id !== closedUserId);
        }
      });
      
      if (roomToCloseOnDisconnect && partnerToNotifyOnDisconnect) {
        activeRooms.delete(roomToCloseOnDisconnect);
        console.log(`Room ${roomToCloseOnDisconnect} closed due to user ${disconnectedUserObj?.username || closedUserId} disconnect.`);
        
        const partnerConn = userConnections.get(partnerToNotifyOnDisconnect.id);
        if (partnerConn && partnerConn.readyState === WebSocket.OPEN) {
          try {
            partnerConn.send(JSON.stringify({
              type: 'partner_disconnected',
              message: `${disconnectedUserObj?.username || 'Your partner'} has disconnected.`
            }));
          } catch(e) { console.error("Error sending partner_disconnected on close:", e); }

          // Remove from any existing queue first
          const partnerWaitingIndex = waitingUsers.findIndex(u => u.id === partnerToNotifyOnDisconnect.id);
          if (partnerWaitingIndex !== -1) waitingUsers.splice(partnerWaitingIndex, 1);
          
          waitingUsers.push(partnerToNotifyOnDisconnect); // Add partner back to queue
          console.log(`Added user ${partnerToNotifyOnDisconnect.username} back to waiting queue.`);
          setTimeout(() => matchUsers(), 1000); // Try to match again
        }
      }
    }
    broadcastOnlineCount(); // Update count after user fully disconnects
  });

  ws.on('error', (error) => {
      const errorUserId = userSockets.get(ws);
      console.error(`WebSocket error for user ${errorUserId || 'unknown'}:`, error);
      // The 'close' event will usually follow, handling cleanup.
  });
});


// Secret stats endpoint
app.get('/api/secret-stats', (req, res) => {
  const providedKey = req.query.key;
  if (providedKey === SECRET_KEY) {
    const dailyVisitsObj = {};
    for (const [date, stats] of dailyVisits) {
      dailyVisitsObj[date] = stats;
    }
    res.json({
      totalVisitors: visitorCount, // Overall total
      dailyVisits: dailyVisitsObj,
      lastUpdated: new Date().toISOString()
    });
  } else {
    res.status(403).json({ error: 'Unauthorized' });
  }
});

// Specific route for the main chat application page
app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Route for secret stats HTML page
app.get('/secretstats', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/stats.html')); // Assuming stats.html is in frontend
});

// Fallback route for root (if not already handled by static serving public/index.html)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Catch-all for other unhandled routes - good for SPAs if frontend handles routing
// Or, for a simpler app, this might just be a 404
// For now, assume static serving or /chat handles all valid frontend routes.


// Rate limiting functions
function isMessageRateLimited(userId) {
  const now = Date.now();
  const userMessages = messageRateLimits.get(userId) || [];
  const recentMessages = userMessages.filter(timestamp => now - timestamp < 60000);
  messageRateLimits.set(userId, recentMessages);
  return recentMessages.length >= MAX_MESSAGES_PER_MINUTE;
}

function trackMessage(userId) {
  const userMessages = messageRateLimits.get(userId) || [];
  userMessages.push(Date.now());
  messageRateLimits.set(userId, userMessages);
}

function isConnectionRateLimited(ip) {
  const now = Date.now();
  const connections = connectionRateLimits.get(ip) || [];
  const recentConnections = connections.filter(timestamp => now - timestamp < 60000);
  
  if (recentConnections.length >= MAX_CONNECTIONS_PER_MINUTE_PER_IP) {
      connectionRateLimits.set(ip, recentConnections); // Update to keep recent ones for continued blocking
      return true;
  }
  recentConnections.push(now); // Add current attempt
  connectionRateLimits.set(ip, recentConnections);
  return false;
}

setInterval(() => { // Clean up rate limit maps
  const now = Date.now();
  messageRateLimits.forEach((timestamps, userId) => {
    const recent = timestamps.filter(ts => now - ts < 60000);
    if (recent.length === 0) messageRateLimits.delete(userId);
    else messageRateLimits.set(userId, recent);
  });
  connectionRateLimits.forEach((timestamps, ip) => {
    const recent = timestamps.filter(ts => now - ts < 60000);
    if (recent.length === 0) connectionRateLimits.delete(ip);
    else connectionRateLimits.set(ip, recent);
  });
}, 5 * 60 * 1000); // Every 5 minutes

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  if (process.env.ALLOWED_ORIGINS) {
    console.log(`Allowed CORS origins: ${process.env.ALLOWED_ORIGINS}`);
  }
  if (!IPINFO_TOKEN) {
      console.warn("IPINFO_TOKEN is not set. Country detection for users will default to 'XX'.");
  } else {
      console.log("IPINFO_TOKEN is set. Country detection for users is active.");
  }
});
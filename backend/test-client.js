const WebSocket = require('ws');

// Create two test clients
const client1 = new WebSocket('ws://localhost:3000');
const client2 = new WebSocket('ws://localhost:3000');

// Client 1 handlers
client1.on('open', () => {
  console.log('Client 1 connected');
  
  // Login with username
  client1.send(JSON.stringify({
    type: 'login',
    username: 'TestUser1'
  }));
});

client1.on('message', (data) => {
  const message = JSON.parse(data);
  console.log('Client 1 received:', message);
  
  // If matched, send a test message
  if (message.type === 'matched') {
    setTimeout(() => {
      client1.send(JSON.stringify({
        type: 'message',
        content: 'Hello from TestUser1!',
        username: 'TestUser1'
      }));
      
      // Send typing indicator
      client1.send(JSON.stringify({
        type: 'typing',
        isTyping: true,
        username: 'TestUser1'
      }));
      
      // Stop typing after 2 seconds
      setTimeout(() => {
        client1.send(JSON.stringify({
          type: 'typing',
          isTyping: false,
          username: 'TestUser1'
        }));
      }, 2000);
    }, 1000);
  }
});

client1.on('close', () => {
  console.log('Client 1 disconnected');
});

client1.on('error', (error) => {
  console.error('Client 1 error:', error);
});

// Client 2 handlers
client2.on('open', () => {
  console.log('Client 2 connected');
  
  // Login with username
  client2.send(JSON.stringify({
    type: 'login',
    username: 'TestUser2'
  }));
});

client2.on('message', (data) => {
  const message = JSON.parse(data);
  console.log('Client 2 received:', message);
  
  // If received a message, reply
  if (message.type === 'message') {
    setTimeout(() => {
      client2.send(JSON.stringify({
        type: 'message',
        content: 'Hello from TestUser2! Nice to meet you.',
        username: 'TestUser2'
      }));
    }, 1500);
  }
  
  // After some time, initiate skip
  if (message.type === 'matched') {
    setTimeout(() => {
      console.log('Client 2 initiating skip...');
      client2.send(JSON.stringify({
        type: 'skip',
        username: 'TestUser2'
      }));
    }, 10000);
  }
});

client2.on('close', () => {
  console.log('Client 2 disconnected');
});

client2.on('error', (error) => {
  console.error('Client 2 error:', error);
});

// Close connections after 15 seconds
setTimeout(() => {
  console.log('Test complete, closing connections');
  client1.close();
  client2.close();
  process.exit(0);
}, 15000);

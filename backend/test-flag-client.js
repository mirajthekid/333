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
});

client2.on('close', () => {
  console.log('Client 2 disconnected');
});

client2.on('error', (error) => {
  console.error('Client 2 error:', error);
});

// Close connections after 10 seconds
setTimeout(() => {
  console.log('Test complete, closing connections');
  client1.close();
  client2.close();
  process.exit(0);
}, 10000);

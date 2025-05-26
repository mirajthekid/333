# Ephemeral Chat

A global, real-time, one-on-one anonymous chat platform with ephemeral sessions and a "hacking style" terminal aesthetic. This application prioritizes privacy, speed, and seamless real-time messaging.

## Features

- **Anonymous Login**: Session-based username with no registration or persistent accounts
- **Random Matchmaking**: FIFO-based queue to pair users globally
- **WebSocket-Based Messaging**: Low-latency, bidirectional real-time communication
- **Text + Emoji Chat Only**: No media, links, or attachments
- **Ephemeral Rooms**: Rooms exist only during the chat with no history retained
- **Glitch Text Effect**: Typing field with a brief scramble-to-character effect
- **Typing Indicators**: Visual feedback for real-time typing
- **Skip Function**: ESC key or button initiates a 3-second cancelable skip timer

## Technical Stack

- **Frontend**: HTML, CSS, JavaScript with terminal-style UI
- **Backend**: Node.js with WebSocket (ws) support
- **State Management**: In-memory for matchmaking and room state
- **No Database**: No persistent storage of messages or user data

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

### Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd ephemeral-chat
   ```

2. Install backend dependencies:
   ```
   cd backend
   npm install
   ```

3. Start the server:
   ```
   npm start
   ```

4. Open the frontend:
   - Navigate to the `frontend` directory
   - Open `index.html` in your browser, or serve it using a static file server

### Development Mode

To run the backend in development mode with automatic restart:
```
cd backend
npm run dev
```

## Project Structure

```
ephemeral-chat/
├── backend/
│   ├── server.js        # WebSocket server implementation
│   └── package.json     # Backend dependencies
├── frontend/
│   ├── index.html       # Main HTML structure
│   ├── styles.css       # Terminal-style UI styling
│   └── scripts.js       # Frontend logic and WebSocket client
└── README.md            # Project documentation
```

## Usage

1. Open the application in your browser
2. Enter a username to connect
3. Wait to be matched with another user
4. Chat in real-time with glitch text effects
5. Use ESC or the SKIP button to find a new chat partner
6. Report inappropriate behavior using the REPORT button

## Security and Privacy

- No messages are stored on the server
- No user accounts or persistent data
- Chats are ephemeral and exist only during the active session
- Simple report system for moderation

## License

[MIT License](LICENSE)

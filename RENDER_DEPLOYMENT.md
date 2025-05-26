# Deploying to Render

This document outlines the steps to deploy the Ephemeral Chat application to Render.

## Deployment Configuration

The application is configured to deploy on Render using the `render.yaml` file. This configuration:
- Sets up a web service
- Installs dependencies from the backend directory
- Starts the Node.js server
- Configures environment variables
- Sets up a health check endpoint

## Manual Deployment Steps

If you prefer to deploy manually through the Render dashboard:

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Use the following settings:
   - **Environment**: Node
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `cd backend && npm start`
   - **Environment Variables**:
     - `NODE_ENV`: `production`

## Important Notes

- The application uses WebSockets for real-time communication
- Static files are served from the backend/public and frontend directories
- The server listens on the port provided by Render's environment variables

## After Deployment

After deploying, your application will be available at the URL provided by Render. The chat application will be accessible at the `/chat` endpoint.

## Troubleshooting

If you encounter issues:
1. Check the Render logs for any errors
2. Verify that WebSockets are properly connecting
3. Ensure all environment variables are correctly set

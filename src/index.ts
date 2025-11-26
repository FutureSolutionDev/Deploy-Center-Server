/**
 * Application Entry Point
 * Main entry file that starts the Deploy Center server
 * Following SOLID principles and PascalCase naming convention
 */

import Server from './Server';

// Start the server
const server = new Server();
server.Start();

// Export server instance
export default server;

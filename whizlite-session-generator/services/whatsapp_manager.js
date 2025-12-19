
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('baileys');
const pino = require('pino');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

// In-memory store for active Baileys sockets
const activeSockets = new Map();

/**
 * Creates and initializes a new WhatsApp connection.
 * @param {string} sessionId - The unique session ID for this connection.
 * @param {function} onUpdate - Callback function to handle updates (e.g., QR code, connection status).
 */
async function createWhatsAppConnection(sessionId, onUpdate) {
    console.log(`[+] Initializing WhatsApp connection for session: ${sessionId}`);

    // Define the path for storing authentication state
    const authPath = path.join(__dirname, '..', 'storage', 'auth_info', sessionId);
    const { state, saveCreds } = await useMultiFileAuthState(authPath);

    const socket = makeWASocket({
        logger: pino({ level: 'silent' }), // Use 'info' for detailed logs
        printQRInTerminal: false, // We'll handle the QR code manually
        browser: Browsers.macOS('Desktop'),
        auth: state,
        shouldSyncHistoryMessage: () => false,
        syncFullHistory: false,
    });

    // Store the socket in our map
    activeSockets.set(sessionId, socket);

    socket.ev.on('creds.update', saveCreds);

    socket.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log(`[*] QR code generated for session: ${sessionId}`);
            onUpdate({ event: 'qr', data: qr });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(`[!] Connection closed for session ${sessionId}. Reason: ${lastDisconnect.error}. Reconnecting: ${shouldReconnect}`);

            // Clean up the socket
            activeSockets.delete(sessionId);

            if (shouldReconnect) {
                // Optionally, you could attempt to reconnect here.
                // For this use case, we'll just let the session end.
            }
            onUpdate({ event: 'close' });
        } else if (connection === 'open') {
            console.log(`[+] WhatsApp connection opened for session: ${sessionId}`);

            // Generate the final session token
            const token = `whiz_${uuidv4().replace(/-/g, '').substring(0, 14)}`;

            onUpdate({
                event: 'authenticated',
                data: {
                    token,
                    jid: socket.user.id
                }
            });

            // We can close the socket after a short delay to ensure the client receives the token
            setTimeout(() => {
                socket.logout();
            }, 3000);
        }
    });

    return socket;
}

/**
 * Retrieves an active Baileys socket by session ID.
 * @param {string} sessionId - The session ID of the socket to retrieve.
 * @returns {Socket|undefined} The active socket, or undefined if not found.
 */
function getSocket(sessionId) {
    return activeSockets.get(sessionId);
}

module.exports = { createWhatsAppConnection, getSocket };

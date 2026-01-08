
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('baileys');
const pino = require('pino');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs-extra');

// In-memory store for active Baileys sockets
const activeSockets = new Map();

/**
 * Creates and initializes a new WhatsApp connection.
 * @param {string} sessionId - The unique session ID for this connection.
 * @param {function} onUpdate - Callback function to handle updates (e.g., QR code, connection status).
 */
async function createWhatsAppConnection(sessionId, onUpdate) {
    console.log(`[+] Initializing WhatsApp connection for session: ${sessionId}`);

    const authPath = path.join(__dirname, '..', 'storage', 'auth_info', sessionId);
    const { state, saveCreds } = await useMultiFileAuthState(authPath);

    const socket = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: Browsers.appropriate('Chrome'),
        auth: state,
        shouldSyncHistoryMessage: () => false,
        syncFullHistory: false,
    });

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

            activeSockets.delete(sessionId);

            // If the disconnection was unexpected, clean up the session data
            if (shouldReconnect) {
                console.log(`[*] Cleaning up corrupted session data for: ${sessionId}`);
                fs.removeSync(authPath);
            }

            onUpdate({ event: 'close', reconnect: shouldReconnect });

        } else if (connection === 'open') {
            console.log(`[+] WhatsApp connection opened for session: ${sessionId}`);

            const token = `whiz_${uuidv4().replace(/-/g, '').substring(0, 14)}`;

            onUpdate({
                event: 'authenticated',
                data: {
                    token,
                    jid: socket.user.id
                }
            });

            setTimeout(() => {
                socket.logout();
            }, 3000);
        }
    });

    return socket;
}

function getSocket(sessionId) {
    return activeSockets.get(sessionId);
}

module.exports = { createWhatsAppConnection, getSocket };

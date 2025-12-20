
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs-extra');
const PhoneNumber = require('awesome-phonenumber');

// In-memory store for active Baileys sockets
const activeSockets = new Map();

/**
 * Creates and initializes a new WhatsApp connection.
 * @param {string} sessionId - The unique session ID for this connection.
 * @param {function} onUpdate - Callback function to handle updates (e.g., QR code, connection status).
 * @param {string} [phoneNumber=null] - Optional phone number for pairing code generation.
 */
async function createWhatsAppConnection(sessionId, onUpdate, phoneNumber = null) {
    console.log(`[+] Initializing WhatsApp connection for session: ${sessionId}`);

    const authPath = path.join(__dirname, '..', 'storage', 'auth_info', sessionId);
    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: Browsers.appropriate('Chrome'),
        auth: state,
        shouldSyncHistoryMessage: () => false,
        syncFullHistory: false,
    });

    activeSockets.set(sessionId, socket);

    socket.ev.on('creds.update', saveCreds);

    if (phoneNumber && !socket.authState.creds.registered) {
        const phone = new PhoneNumber('+' + phoneNumber);
        if (!phone.isValid()) {
            onUpdate({ event: 'error', data: 'Invalid phone number' });
            return;
        }
        const numberForPairing = phone.getNumber('e164').replace('+', '');
        setTimeout(async () => {
            try {
                const code = await socket.requestPairingCode(numberForPairing);
                onUpdate({ event: 'pair-code', data: code });
            } catch (error) {
                console.error('Failed to request pairing code:', error);
                onUpdate({ event: 'error', data: 'Failed to request pairing code' });
            }
        }, 1500);
    }

    socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (connection === 'open') {
            console.log(`[+] WhatsApp connection opened for session: ${sessionId}`);
            const token = `whiz_${uuidv4().replace(/-/g, '').substring(0, 14)}`;
            onUpdate({
                event: 'authenticated',
                data: { token, jid: socket.user.id }
            });
            setTimeout(() => {
                socket.logout();
            }, 3000);
        } else if (qr) {
            console.log(`[*] QR code generated for session: ${sessionId}`);
            onUpdate({ event: 'qr', data: qr });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(`[!] Connection closed for session ${sessionId}. Reason: ${lastDisconnect.error}. Reconnecting: ${shouldReconnect}`);

            activeSockets.delete(sessionId);

            if (shouldReconnect) {
                console.log(`[*] Cleaning up corrupted session data for: ${sessionId}`);
                fs.removeSync(authPath);
            }

            onUpdate({ event: 'close', reconnect: shouldReconnect });
        }
    });

    return socket;
}

function getSocket(sessionId) {
    return activeSockets.get(sessionId);
}

module.exports = { createWhatsAppConnection, getSocket };

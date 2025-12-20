
const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const qrcode = require('qrcode');
const sseExpress = require('sse-express');
const { createWhatsAppConnection, getSocket } = require('./services/whatsapp_manager');

const app = express();
const port = process.env.PORT || 3000;

// In-memory store for session data.
const sessions = {};
// Store active SSE connections
const sseConnections = {};

// Serve static files from the 'web' directory
app.use(express.static(path.join(__dirname, 'web')));

/**
 * @api {get} /session Request a new session and initialize WhatsApp connection
 * @apiName CreateSession
 * @apiGroup Session
 */
app.get('/session', (req, res) => {
    const sessionId = uuidv4();
    sessions[sessionId] = { status: 'pending', qr: null, token: null };
    console.log(`[+] New session created: ${sessionId}`);

    // Initialize the WhatsApp connection for this session
    createWhatsAppConnection(sessionId, (update) => {
        // This callback handles all updates from the WhatsApp manager
        if (sseConnections[sessionId]) {
            if (update.event === 'qr') {
                qrcode.toDataURL(update.data, (err, url) => {
                    if (err) {
                        console.error('[-] Failed to generate QR code data URL:', err);
                        return;
                    }
                    sseConnections[sessionId].sse('message', { event: 'qr', data: url });
                });
            } else {
                sseConnections[sessionId].sse('message', update);
            }
        }
    });

    res.json({ sessionId });
});

app.get('/pair', async (req, res) => {
    const { number } = req.query;
    if (!number) {
        return res.status(400).send('Phone number is required');
    }

    const sessionId = uuidv4();
    sessions[sessionId] = { status: 'pending', qr: null, token: null };
    console.log(`[+] New pairing session created: ${sessionId} for number: ${number}`);

    createWhatsAppConnection(sessionId, (update) => {
        if (sseConnections[sessionId]) {
            sseConnections[sessionId].sse('message', update);
        }
    }, number);

    res.json({ sessionId });
});

/**
 * @api {get} /events/:sessionId Subscribe to real-time session updates
 * @apiName GetSessionEvents
 * @apiGroup Session
 */
app.get('/events/:sessionId', sseExpress, (req, res) => {
    const { sessionId } = req.params;
    if (!sessionId || !sessions[sessionId]) {
        return res.status(400).send('Invalid session ID');
    }
    sseConnections[sessionId] = res;
    console.log(`[+] Client connected for session: ${sessionId}`);
    req.on('close', () => {
        delete sseConnections[sessionId];
        console.log(`[-] Client disconnected for session: ${sessionId}`);
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'index.html'));
});

app.listen(port, () => {
    console.log(`Whizlite-Session-Generator is running at http://localhost:${port}`);
});

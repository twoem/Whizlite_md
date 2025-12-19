
const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const qrcode = require('qrcode');
const sseExpress = require('sse-express');

const app = express();
const port = process.env.PORT || 3000;

// In-memory store for session data.
// In a production environment, this would be a database like MongoDB or Redis.
const sessions = {};

// Store active SSE connections
const sseConnections = {};

// Serve static files from the 'web' directory
app.use(express.static(path.join(__dirname, 'web')));

/**
 * @api {get} /session Request a new session ID
 * @apiName CreateSession
 * @apiGroup Session
 *
 * @apiSuccess {String} sessionId The unique ID for the new session.
 */
app.get('/session', (req, res) => {
    const sessionId = uuidv4();
    // Initialize the session with a 'pending' status
    sessions[sessionId] = { status: 'pending', token: null };
    console.log(`[+] New session created: ${sessionId}`);
    res.json({ sessionId });
});

/**
 * @api {get} /qr Request a QR code for a session
 * @apiName GetQRCode
 * @apiGroup Session
 *
 * @apiParam {String} sessionId The session ID to generate the QR code for.
 *
 * @apiSuccess {String} dataURL A Data URL representing the QR code image.
 * @apiError {String} 400 Invalid or missing session ID.
 * @apiError {String} 500 Failed to generate QR code.
 */
app.get('/qr', async (req, res) => {
    const { sessionId } = req.query;
    if (!sessionId || !sessions[sessionId]) {
        return res.status(400).send('Invalid or missing session ID');
    }

    // The URL that will be embedded in the QR code.
    // When a user scans it, their device will make a GET request to this endpoint.
    const scanUrl = `${req.protocol}://${req.get('host')}/scan/${sessionId}`;
    console.log(`[*] Generating QR code for URL: ${scanUrl}`);

    try {
        const qrCodeImage = await qrcode.toDataURL(scanUrl);
        res.send(qrCodeImage);
    } catch (err) {
        console.error('[-] Failed to generate QR code:', err);
        res.status(500).send('Failed to generate QR code');
    }
});

/**
 * @api {get} /events/:sessionId Subscribe to real-time session updates
 * @apiName GetSessionEvents
 * @apiGroup Session
 *
 * @apiParam {String} sessionId The session ID to subscribe to.
 */
app.get('/events/:sessionId', sseExpress, (req, res) => {
    const { sessionId } = req.params;
    if (!sessionId || !sessions[sessionId]) {
        return res.status(400).send('Invalid session ID');
    }

    // Store the connection
    sseConnections[sessionId] = res;
    console.log(`[+] Client connected for session: ${sessionId}`);

    // When the client disconnects, remove them from the list
    req.on('close', () => {
        delete sseConnections[sessionId];
        console.log(`[-] Client disconnected for session: ${sessionId}`);
    });
});

/**
 * @api {get} /scan/:sessionId Simulate scanning the QR code
 * @apiName ScanQRCode
 * @apiGroup Session
 *
 * @apiParam {String} sessionId The session ID from the QR code.
 *
 * @apiSuccess {String} 200 OK message.
 * @apiError {String} 400 Invalid or missing session ID.
 */
app.get('/scan/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = sessions[sessionId];

    if (!session || session.status !== 'pending') {
        return res.status(400).send('Invalid or expired session ID');
    }

    // Notify the client that the QR code has been scanned
    if (sseConnections[sessionId]) {
        sseConnections[sessionId].sse('message', { status: 'scanned' });
    }

    // Simulate some processing time before generating the token
    setTimeout(() => {
        // Generate the token
        const token = `whiz_${uuidv4().replace(/-/g, '').substring(0, 12)}`;
        session.status = 'authenticated';
        session.token = token;

        console.log(`[+] Token generated for session ${sessionId}: ${token}`);

        // Send the token to the client
        if (sseConnections[sessionId]) {
            sseConnections[sessionId].sse('message', { status: 'authenticated', token });
        }
    }, 2000); // 2-second delay

    res.send('Scan successful! Please check your browser.');
});

// The root path will serve the main index.html file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'index.html'));
});

app.listen(port, () => {
    console.log(`Whizlite-Session-Generator is running at http://localhost:${port}`);
});

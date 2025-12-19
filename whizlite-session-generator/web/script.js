
document.addEventListener('DOMContentLoaded', async () => {
    const qrCodeImage = document.getElementById('qr-code');
    const loadingSpinner = document.getElementById('loading-spinner');
    const statusMessage = document.getElementById('status-message');
    const tokenContainer = document.getElementById('token-container');
    const sessionTokenElement = document.getElementById('session-token');

    let sessionId = null;

    async function initializeSession() {
        try {
            // 1. Get a new session ID from the server
            const sessionResponse = await fetch('/session');
            const sessionData = await sessionResponse.json();
            sessionId = sessionData.sessionId;

            // 2. Use the session ID to get the QR code
            const qrResponse = await fetch(`/qr?sessionId=${sessionId}`);
            const qrCodeDataUrl = await qrResponse.text();

            // 3. Display the QR code
            qrCodeImage.src = qrCodeDataUrl;
            qrCodeImage.style.display = 'block';
            loadingSpinner.style.display = 'none';
            statusMessage.textContent = 'Scan the QR code to proceed.';

            // 4. Start listening for real-time updates
            listenForUpdates();

        } catch (error) {
            console.error('Error initializing session:', error);
            statusMessage.textContent = 'Failed to initialize session. Please refresh the page.';
        }
    }

    function listenForUpdates() {
        if (!sessionId) return;

        const eventSource = new EventSource(`/events/${sessionId}`);

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.status === 'scanned') {
                statusMessage.textContent = 'QR code scanned. Generating token...';
            }

            if (data.status === 'authenticated' && data.token) {
                // Update the UI with the final token
                sessionTokenElement.textContent = data.token;
                tokenContainer.style.display = 'block';
                document.getElementById('qr-container').style.display = 'none';
                statusMessage.textContent = 'Session authenticated successfully!';
                eventSource.close(); // We're done, so close the connection
            }
        };

        eventSource.onerror = () => {
            // The connection was lost. The server might have shut down, or there's a network issue.
            // You might want to try reconnecting after a delay.
            statusMessage.textContent = 'Connection to server lost. Please refresh.';
            eventSource.close();
        };
    }

    initializeSession();
});

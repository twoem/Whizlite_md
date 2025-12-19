
document.addEventListener('DOMContentLoaded', () => {
    const qrCodeImage = document.getElementById('qr-code');
    const loadingSpinner = document.getElementById('loading-spinner');
    const statusMessage = document.getElementById('status-message');
    const tokenContainer = document.getElementById('token-container');
    const sessionTokenElement = document.getElementById('session-token');

    let sessionId = null;

    async function initializeSession() {
        // Reset UI to initial state
        qrCodeImage.style.display = 'none';
        loadingSpinner.style.display = 'block';
        statusMessage.textContent = 'Generating QR code, please wait...';
        tokenContainer.style.display = 'none';

        try {
            const response = await fetch('/session');
            const data = await response.json();
            sessionId = data.sessionId;
            listenForUpdates();
        } catch (error) {
            console.error('Error initializing session:', error);
            statusMessage.textContent = 'Failed to initialize. Please refresh.';
        }
    }

    function listenForUpdates() {
        if (!sessionId) return;
        const eventSource = new EventSource(`/events/${sessionId}`);

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            handleServerEvent(data);
        };

        eventSource.onerror = () => {
            statusMessage.textContent = 'Connection lost. Attempting to reconnect...';
            eventSource.close();
            // The server will automatically clean up, and the client will re-initialize
            setTimeout(initializeSession, 3000); // Re-initialize after a delay
        };
    }

    function handleServerEvent(eventData) {
        switch (eventData.event) {
            case 'qr':
                qrCodeImage.src = eventData.data;
                qrCodeImage.style.display = 'block';
                loadingSpinner.style.display = 'none';
                statusMessage.textContent = 'Scan the QR code to proceed.';
                break;
            case 'authenticated':
                sessionTokenElement.textContent = eventData.data.token;
                tokenContainer.style.display = 'block';
                document.getElementById('qr-container').style.display = 'none';
                statusMessage.textContent = `Authenticated with ${eventData.data.jid}`;
                break;
            case 'close':
                if (eventData.reconnect) {
                    statusMessage.textContent = 'Connection closed unexpectedly. Generating a new QR code...';
                    // The server will clean up, and we'll start a new session.
                    setTimeout(initializeSession, 2000);
                } else {
                    statusMessage.textContent = 'Connection closed. Please refresh to start over.';
                }
                break;
        }
    }

    initializeSession();
});

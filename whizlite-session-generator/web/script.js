
document.addEventListener('DOMContentLoaded', () => {
    const qrCodeImage = document.getElementById('qr-code');
    const loadingSpinner = document.getElementById('loading-spinner');
    const statusMessage = document.getElementById('status-message');
    const tokenContainer = document.getElementById('token-container');
    const sessionTokenElement = document.getElementById('session-token');

    let sessionId = null;

    async function initializeSession() {
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
            statusMessage.textContent = 'Connection lost. Please refresh.';
            eventSource.close();
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
                statusMessage.textContent = 'Connection closed. Please refresh to start over.';
                break;
        }
    }

    initializeSession();
});

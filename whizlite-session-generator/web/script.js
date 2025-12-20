
    // Mode toggle functionality
    document.querySelectorAll('.mode-btn').forEach(button => {
      button.addEventListener('click', function() {
        // Update active button
        document.querySelectorAll('.mode-btn').forEach(btn => {
          btn.classList.remove('active');
        });
        this.classList.add('active');

        // Show corresponding section
        const mode = this.getAttribute('data-mode');
        document.querySelectorAll('.content-section').forEach(section => {
          section.classList.remove('active');
        });
        document.getElementById(`${mode}-section`).classList.add('active');

        // Reset QR timer when switching to QR mode
        if (mode === 'qr') {
          resetQRTimer();
        }
      });
    });

    // Pair code functionality
    document.getElementById("submit").addEventListener("click", async (e) => {
        e.preventDefault();
        const mobileNumberInput = document.getElementById("mobileNumber");
        const codeDisplay = document.getElementById("codeDisplay");
        const loadingSpinner = document.getElementById("loading");

        const mobileNumber = mobileNumberInput.value.trim();
        if (!mobileNumber) {
            codeDisplay.innerHTML = '<div class="error-message"><i class="fas fa-exclamation-circle"></i> Please enter your WhatsApp number</div>';
            document.getElementById("copy").style.display = "none";
            return;
        }

        loadingSpinner.style.display = "block";
        codeDisplay.innerHTML = '';
        document.getElementById("copy").style.display = "none";

        try {
            const response = await axios.get(`/pair?number=${mobileNumber.replace(/[^0-9]/g, "")}`);
            const { sessionId } = response.data;

            const eventSource = new EventSource(`/events/${sessionId}`);
            eventSource.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.event === 'pair-code') {
                    const code = data.data;
                    codeDisplay.innerHTML = `<div class="success-message"><i class="fas fa-check-circle"></i> CODE: ${code}</div>`;
                    document.getElementById("copy").style.display = "flex";
                    eventSource.close();
                } else if (data.event === 'error') {
                    codeDisplay.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-circle"></i> ${data.data}</div>`;
                    eventSource.close();
                }
            };
        } catch (error) {
            console.error("Error generating code:", error);
            codeDisplay.innerHTML = '<div class="error-message"><i class="fas fa-exclamation-circle"></i> Error generating code. Please try again.</div>';
        } finally {
            loadingSpinner.style.display = "none";
        }
    });

    function copyCode() {
      const codeDisplay = document.getElementById("codeDisplay").innerText;
      const code = codeDisplay.replace('CODE: ', '');
      const copyBtn = document.getElementById("copy");

      navigator.clipboard.writeText(code).then(() => {
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        copyBtn.disabled = true;
        copyBtn.style.opacity = "0.6";
        copyBtn.style.cursor = "not-allowed";

        const toast = document.getElementById("toast");
        toast.style.display = "block";
        toast.style.opacity = "1";

        setTimeout(() => {
          copyBtn.innerHTML = originalText;
          copyBtn.disabled = false;
          copyBtn.style.opacity = "1";
          copyBtn.style.cursor = "pointer";

          toast.style.opacity = "0";
          setTimeout(() => {
            toast.style.display = "none";
          }, 300);
        }, 2000);
      }).catch(err => {
        console.error("Failed to copy text: ", err);
      });
    }

    // QR Timer functionality
    let timeleft = 30;
    let downloadTimer;
    let qrEventSource;

    async function resetQRTimer() {
        clearInterval(downloadTimer);
        if (qrEventSource) {
            qrEventSource.close();
        }
        timeleft = 30;
        document.getElementById("time-left").textContent = timeleft;
        document.getElementById("progressBar").value = 0;

        const qrLoading = document.getElementById("qrLoading");
        const qrImage = document.getElementById("qr-image");

        qrLoading.classList.add("active");
        qrImage.style.opacity = "0.3";

        try {
            const response = await axios.get('/session');
            const { sessionId } = response.data;

            qrEventSource = new EventSource(`/events/${sessionId}`);
            qrEventSource.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.event === 'qr') {
                    qrImage.src = data.data;
                    qrLoading.classList.remove("active");
                    qrImage.style.opacity = "1";
                    startQRTimer();
                } else if (data.event === 'authenticated') {
                    // Handle authenticated state
                    clearInterval(downloadTimer);
                    document.getElementById("time-left").textContent = "Authenticated!";
                }
            };
        } catch (error) {
            console.error("Error getting session:", error);
            qrLoading.classList.remove("active");
            qrImage.style.opacity = "1";
        }
    }

    function startQRTimer() {
        downloadTimer = setInterval(() => {
            if (timeleft <= 0) {
                clearInterval(downloadTimer);
                document.getElementById("time-left").textContent = "QR Expired!";
                resetQRTimer();
            } else {
                document.getElementById("progressBar").value = 30 - timeleft;
                document.getElementById("time-left").textContent = timeleft;
                timeleft -= 1;
            }
        }, 1000);
    }

    // QR Regeneration functionality
    document.getElementById("reloadQR").addEventListener("click", function() {
      resetQRTimer();
    });

    // Initialize QR timer when page loads
    resetQRTimer();

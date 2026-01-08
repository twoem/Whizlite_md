# Whiz-Lite-MD

Public bridge and interface for the Whiz-Lite-MD ecosystem. This repository is the main deployment point and handles the public-facing aspects of the application.

## 🚀 Getting Started

1.  Clone the repository: `git clone https://github.com/whizlitebot/whizlite_md.git`
2.  Install dependencies: `npm install`
3.  Set up your environment variables in a `.env` file.
4.  Start the application: `npm start`

## 📁 Repository Structure

```
whizlite_md/
├── main.js                          # Primary entry point
├── package.json                    # Public dependencies
├── .env                            # Environment variables
├── .gitignore
├── README.md
├── bridge/
│   ├── client.js                   # Baileys MD WhatsApp connection
│   ├── message_proxy.js            # Secure routing to Repo 3
│   └── session_manager.js          # Token-based session handling
├── config/
│   ├── settings.js                 # Public configurations
│   └── constants.js                # Application constants
└── utils/
    ├── logger.js                   # Logging system
    └── validator.js                # Input validation
```

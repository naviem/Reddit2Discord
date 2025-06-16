require('dotenv').config();
const ConfigManager = require('./configManager');
const Scanner = require('./scanner');

async function main() {
    try {
        // Initialize config manager
        const configManager = new ConfigManager();
        await configManager.loadConfig();

        // Initialize scanner
        const scanner = new Scanner(configManager);
        
        // Start scanning
        await scanner.startScanning();

        // Handle process termination
        process.on('SIGINT', async () => {
            console.log('Stopping scanner...');
            scanner.stopScanning();
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            console.log('Stopping scanner...');
            scanner.stopScanning();
            process.exit(0);
        });

    } catch (error) {
        console.error('Error starting application:', error);
        process.exit(1);
    }
}

main(); 
const ConfigManager = require('./configManager');

async function main() {
    const configManager = new ConfigManager();
    await configManager.loadConfig();
    await configManager.showMenu();
}

main().catch(console.error); 
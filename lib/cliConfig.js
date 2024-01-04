const fs = require('fs');
const path = require('path');
const toml = require('@iarna/toml');

const cliConfigDir = path.join(process.env.HOME || process.env.USERPROFILE, '.reproduce-work');

function buildCLIConfig() {
    const configFile = path.join(cliConfigDir, 'config.toml');
    const config = {};
    if (!fs.existsSync(cliConfigDir)) {
        fs.mkdirSync(cliConfigDir);
    }
    fs.writeFileSync(configFile, toml.dump(config));
}

module.exports = {
    cliConfigDir,
    buildCLIConfig
};
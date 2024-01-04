/*
const fs = require('fs');

const { cliConfigDir, buildCLIConfig } = require('./cliConfig');

if (!fs.existsSync(cliConfigDir)) {
    try {
        fs.mkdirSync(cliConfigDir);
        console.log(`Created directory: ${cliConfigDir}`);
        buildCLIConfig();
    } catch (err) {
        console.error(`Error creating directory ${cliConfigDir}: ${err.message}`);
    }
} else {
    console.log(`Directory ${cliConfigDir} already exists.`);
}
*/

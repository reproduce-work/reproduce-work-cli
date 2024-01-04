const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');
const { execSync, exec, spawn } = require('child_process');
const {
    findAvailablePort, loadReproConfig, parseCommand
} = require('../utils');
const currentPath = process.cwd();


function getDevelopCommandScript(port=8888) {
    const reproDir = process.env.REPROWORKDIR || '.reproduce';
    const projectDir = path.join(currentPath, reproDir);
    const rwConfigPath = path.join(projectDir, 'config.toml');

    if (!fs.existsSync(rwConfigPath)) {
        console.error('Project not initialized');
        process.exit(1);
    }
    
    config = loadReproConfig();
    sciEnv = config.rw.env.scientific;
    docEnv = config.rw.env.report;
    //config = formatFilesInConfig(config);

    let privateDataCommand = '';
    /*
    if (config.repro.files.private_dir) {
        if (fs.existsSync(path.join(currentPath, config.repro.files.private_dir))) {
            privateDataCommand += `-v $(pwd)/${config.repro.files.private_dir}:/home/private`;
        }
    }*/

    let portSharingCommand = '';
    if (sciEnv=='jupyter') {
        portSharingCommand += `-p ${port}:8888`;
    }
    let dev_script = `docker run --rm -v $(pwd):/home/jovyan${privateDataCommand} ${portSharingCommand} rw-${config.rw.env.slug}`
    return dev_script;
}

function developCommand(options) {

    const reproDir = process.env.REPROWORKDIR || '.reproduce';
    console.log(options);

    const projectDir = path.join(currentPath, reproDir);
    const rwConfigPath = path.join(projectDir, 'config.toml');

    if (!fs.existsSync(rwConfigPath)) {
        console.error('Project not built');
        process.exit(1);
    }
    
    config = loadReproConfig();

    try {

        (async () => {
            try {
                let localport;
        
                if (options.port) {
                    localport = options.port;
                } else {
                    localport = await findAvailablePort(8888);
                    //console.log(`Found available port: ${localport}`);
                }
        
                dev_script = getDevelopCommandScript(port=localport);
                // replace $(pwd) with process's current working directory
                const currentDir = process.cwd();
                dev_script = dev_script.replace(/\$\((pwd)\)/g, currentDir);
                const { command, args } = parseCommand(dev_script);
                const projectContainer = spawn(command, args, { detached: false });

                projectContainer.stdout.on('data', (data) => {
                    console.log(`stdout: ${data}`);
                });

                // Handle the STDOUT/STDERR of the scientific environment
                if(config.rw.env.scientific=='jupyter'){

                    let printedUrl = false;

                    projectContainer.stderr.on('data', (data) => {
                        const output = data.toString();
                        
                        if (options.sciV){
                            console.log(output); // Log the output for debugging
                        }

                        const regex = /http:\/\/(127\.0\.0\.1|localhost|[\w]+):(\d+)\/lab(?:\?token=([a-z0-9]+))?/;
                        const match = output.match(regex);

                        if (match) {
                            const host = match[1];
                            const port = match[2];
                            const token = match[3] || ''; // Token will be undefined if not present, so use an empty string as a fallback
                            const url = token ? `http://localhost:${localport}/lab?token=${token}` : `http://localhost:${port}/lab`;
                            if (!printedUrl) {
                                console.log(`\n\nJupyter server running at:\n${url}\n\n`);
                                printedUrl = true;
                            }
                        }
                    });

                } else {
                    projectContainer.stderr.on('data', (data) => {
                        console.error(`stderr: ${data}`);
                    });
                }
                
                projectContainer.on('close', (code) => {
                    console.log(`Scientific environemnt exited with code ${code}`);
                });
                
                // Error handling
                projectContainer.on('error', (err) => {
                    console.error('Failed to start scientific environment:', err);
                });
        
            } catch (error) {
                console.error('Error:', error);
            }
        })();



        // watcher 
        if (options.watch) {
            watchFiles = config.repro.files.watch;
            const watcher = chokidar.watch(watchFiles, {
                persistent: true
            });
            
            watcher.on('change', path => {
                console.log(`File ${path} has been changed. Re-compiling report...`);
            
                try {
                    //console.log(config.stage.assemble.script);
                    exec(config.stage.assemble.script, (error, stdout, stderr) => {
                        if (error) {
                            console.error(`Error executing the script: ${error.message}`);
                            console.error(`Error Stack: ${error.stack}`);
                            return;
                        }
                        
                        if (stdout && stdout.trim().length > 0) {

                            if(options.docV){
                                console.log(`STDOUT: ${stdout}`);
                            } else {
                                // if "Output written on report.pdf" not in stdout
                                // assume error and log stdout
                                if (!stdout.includes('Output written on report.pdf')) {
                                    console.error(`\n\nProblem compiling report.\n\nOUTPUT:\n${stdout}`);
                                } else {
                                    console.log('Document written to report/compiled.pdf')
                                } 
                            }                               
                        }
                        
                        if (stderr && stderr.trim().length > 0) {
                            console.error(`STDERR: ${stderr}`);
                        }
                    });
                } catch (ex) {
                    console.error(`An unexpected error occurred: ${ex.message}`);
                    console.error(`Error Stack: ${ex.stack}`);
                }
            });            
            console.log(`Watching for changes in: ${watchFiles}`);
        }


        /* Cleanup function to stop Jupyter server and watcher
        function cleanup() {
            console.log('Cleaning up before exiting...');

            // Stop the Jupyter server
            //projectContainer.kill();

            // Stop the watcher
            watcher.close().then(() => console.log('Watcher stopped.'));

        }

        // Handle exit signals
        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
        process.on('SIGQUIT', cleanup);
        */
        
    } catch (err) {
        console.error(`Error running develop script: ${err.message}`);
        process.exit(1);
    }
}

module.exports = {developCommand,getDevelopCommandScript};

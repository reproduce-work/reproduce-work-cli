const path = require('path');
const fs = require('fs');
const open = require('open');
const { exec, spawn, execSync } = require('child_process');
const Docker = require('dockerode');
const utils = require('../utils');
//const {getSciEnvCommandScript} = require('./sciEnv');
const currentPath = process.cwd();

let Screen;

function startProjectInstance(options) {
    
    const config = utils.loadReproConfig();
    const sciEnv = config.rw.env.scientific;

    try {
        (async () => {

            let openMessage = '';
            if (options.open) {
                openMessage = '';
            } else {
                openMessage = 'Use -o/--open flag to open automatically in your default browser.';
            }
            
            try {
                
                let localport;
                let appPort;
                
                if (options.port) {
                    localport = options.port;
                } else {
                    localport = await utils.findPortForSciEnv(sciEnv);
                    //appPort = await findPortForSciEnv('rw-proxy');
                }             
                utils.setNestedProp(config, 'rw.env.vars.RW_SCIENV_LOCAL_PORT', `${localport}`, save=true);   

                var rw_launch_script = config.stage.launch.script;

                let sciEnvVars = {};
                // for k matching pattern $RW_[A-Z]+, read from config.rw.env.vars:
                for (const k in config.rw.env.vars) {
                    const regex = /RW_[A-Z_]+/;
                    if (k.match(regex) ){
                        // 'PORT' in key, conver to integer
                        if (k.includes('PORT')) {
                            sciEnvVars[k] = parseInt(config.rw.env.vars[k]);
                        } else {
                            sciEnvVars[k] = config.rw.env.vars[k];
                        }
                        //console.log(`Found ${k} in config.rw.env.vars; value: ${config.rw.env.vars[k]}`);
                    }
                }

                // for k matching pattern $[A-Z]+, read from process.env:
                for (const k in process.env) {
                    if (k.match(/\$[A-Z]+/)) {
                        sciEnvVars[k] = process.env[k];
                    }
                }
                //console.log(sciEnvVars);

                const pathToDocker = utils.findDockerPath();
                if (pathToDocker) {
                    // Check if sciEnvVars already has a PATH entry
                    if (sciEnvVars['PATH']) {
                      // Append pathToDocker to the existing PATH
                      sciEnvVars['PATH'] = `${sciEnvVars['PATH']}:${pathToDocker}`;
                    } else {
                      // Set PATH in sciEnvVars to the current PATH plus pathToDocker
                      sciEnvVars['PATH'] = `${process.env.PATH}:${pathToDocker}`;
                    }
                } else {
                    console.error('Docker is not installed or not found in PATH');
                    process.exit(1);
                }

                const currentDir = process.cwd();
                rw_launch_script = rw_launch_script.replace(/\$\((pwd)\)/g, currentDir);
                const { command, args } = utils.parseCommand(rw_launch_script);
                

                let rwInterfaceContainer;

                // Handle the I/O of the scientific environment
                if(sciEnv=='jupyter'){

                    if (localport!==8888) {
                        if (Screen){
                            utils.updateRWLog('Default Jupyter port 8888 is already in use; using port ' + localport + ' instead');
                        }
                    }

                    sciEnvVars['RW_SCIENV_IMAGE_PORT'] = 8888;
                    sciEnvVars['RW_SCIENV_VOLUME'] = '/home/jovyan';

                    //console.log(sciEnvVars);
                    //console.log(command);
                    //console.log(args);

                    rwInterfaceContainer = spawn(command, args, {
                         shell: true,
                         detached: false, 
                         ws: true,
                         env: sciEnvVars 
                    });
                    Screen = utils.initScreen(config, rwInterfaceContainer);

                    rwInterfaceContainer.stdout.on('data', (data) => {
                        utils.updateSciLog(`stdout: ${data}`);
                    });

                    

                    let printedUrl = false;
                    let url = '';
                    let opened = false;

                    rwInterfaceContainer.stderr.on('data', (data) => {
                        const output = data.toString();
                        utils.updateSciLog(output);
                        
                        const regex = /http:\/\/(127\.0\.0\.1|localhost|[\w]+):(\d+)\/lab(?:\?token=([a-z0-9]+))?/;
                        const match = output.match(regex);

                        if (match) {
                            const host = match[1];
                            const port = match[2];
                            const token = match[3] || ''; // Token will be undefined if not present, so use an empty string as a fallback
                            url = token ? `http://localhost:${localport}/lab?token=${token}` : `http://localhost:${appPort}/lab`;
                            if (!printedUrl) {
                                utils.updateRWLog(`\n\nJupyter server running at:\n${utils.formatHyperlink(url)}\n${openMessage}\n`);
                                printedUrl = true;
                            }

                            if (options.open && !opened) {
                                open(url);
                                opened = true;
                            }
                        }

                    });

                    rwInterfaceContainer.on('close', (code) => {
                        console.log(`Scientific environemnt exited with code ${code}`);
                    });
                    
                    // Error handling
                    rwInterfaceContainer.on('error', (err) => {
                        console.error('Failed to start scientific environment:', err);
                    });

                } else if (sciEnv=='python') {
                    if (options.open) {
                        console.log('Open flag not supported for Python scientific environment');
                    }
                    //console.log(rw_launch_script);
                    rwInterfaceContainer = execSync(rw_launch_script, {stdio: 'inherit'});

                } else if (sciEnv=='rstudio') {
                    
                    //console.log(sciEnvVars);
                    //console.log(command);
                    //console.log(args);

                    rwInterfaceContainer = spawn(command, args, {
                         shell: true,
                         detached: false, 
                         ws: true,
                         env: sciEnvVars 
                    });
                    Screen = utils.initScreen(config, rwInterfaceContainer);

                    rwInterfaceContainer.stdout.on('data', (data) => {
                        utils.updateSciLog(`stdout: ${data}`);
                    });

                    

                    let printedUrl = false;
                    let url = '';
                    let opened = false;

                    rwInterfaceContainer.stderr.on('data', (data) => {
                        const output = data.toString();
                        utils.updateSciLog(output);
             
                        //url = `http://localhost:${appPort}` 
                        url = `http://localhost:${localport}`
                        if (!printedUrl) {
                            utils.updateRWLog(`\n\RStudio server running at:\n${utils.formatHyperlink(url)}\n${openMessage}\n`);
                            printedUrl = true;
                        }

                        if (options.open && !opened) {
                            open(url);
                            opened = true;
                        }
                    

                    });


                    rwInterfaceContainer.on('close', (code) => {
                        console.log(`Scientific environemnt exited with code ${code}`);
                    });
                    
                    // Error handling
                    rwInterfaceContainer.on('error', (err) => {
                        console.error('Failed to start scientific environment:', err);
                    });
                }
        
            } catch (error) {
                console.error('Error:', error);
            }
        })();

        
    } catch (err) {
        console.error(`Error running develop script: ${err.message}`);
        process.exit(1);
    }
}


function launchCommand(options) {

    if (!fs.existsSync(utils.rwConfigPath)) {
        console.error('Project not initialized; run "rw init --sci-env=<environment>" first');
        process.exit(1);
    }
    
    const config = utils.loadReproConfig();
    const projectSlug = config.rw.env.slug;

    // use dockerode to check for existence of rw-${config.rw.env.slug} image
    const docker = new Docker({ socketPath: '/var/run/docker.sock' });
    docker.listImages(function (err, images) {
        if (err) {
            console.error('Error listing images:', err);
        } else {
            const projectImageExists = images.some(function (image) {
                return image.RepoTags.some(function(tag) {
                const [imageName] = tag.split(':'); // Split at colon and get the first part
                return imageName === `rw-${projectSlug}`;
                });
            });

            if (!projectImageExists) {
                console.log(`Missing project image: rw-${projectSlug}; run "rw build" first`);
                process.exit(1);
            }
        }
    });

    // Make sure that the container is not already running
    docker.listContainers(function (err, containers) {
        if (err) {
            console.error('Error listing containers:', err);
        } else {
            const projectContainerRunning = containers.some(container => {
                return container.Names.some(name => name.includes('reproduce-'));
            });

            if (projectContainerRunning) {
                console.log(`reproduce.work project environment (${projectSlug}) is already running; start a new instance?`);
                console.log('- Yes: create new instance? (y),');
                console.log('- Kill existing to begin new (k), or');
                console.log('- Cancel (c)? (y/k/c)?');
                process.stdin.resume();
                process.stdin.setEncoding('utf8');
                process.stdin.on('data', function (text) {
                    if (text === 'y\n') {
                        console.log('Keep in mind all running instances of project environment act on the same local files.');
                        startProjectInstance(options);
                    } else if (text === 'c\n') {
                        process.exit(1);
                    } else if (text === 'k\n') {
                        console.log('Killing existing instance...');

                        // use dockerode to kill existing containers/container groups;
                        // i.e., any that match names with "reproduce-*" or "rw-*"
                        docker.listContainers(function (err, containers) {
                            if (err) {
                                console.error('Error listing containers:', err);
                            } else {
                                
                                const containersToKill = containers.filter(container => {
                                    const containerName = container.Names[0];
                                    return containerName.includes('reproduce-') || containerName.includes('rw-');
                                });

                                containersToKill.forEach(container => {
                                    docker.getContainer(container.Id).kill(function (err) {
                                        if (err) {
                                            console.error(`Error killing container ${container.Id}:`, err);
                                        } else {
                                            console.log(`Container ${container.Id} killed successfully.`);
                                        }
                                    });
                                });

                                startProjectInstance(options);
                            }
                        });


                    } else if (text === 'c\n') {
                        console.log('Cancelled.');
                        process.exit(1);
                    }
                });
            } else {
                startProjectInstance(options);
            }
        }
    });

}

module.exports = {launchCommand};

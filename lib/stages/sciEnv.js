const path = require('path');
const fs = require('fs');
const open = require('open');
const { execSync, spawn } = require('child_process');
const Docker = require('dockerode');
const {
    rwConfigPath, reproDir, reproPath,
    findPortForSciEnv, loadReproConfig, parseCommand,
    replaceEnvVarsInArgs
} = require('../utils');
//const { config } = require('process');


function getSciEnvCommandScript() {

    if (!fs.existsSync(rwConfigPath)) {
        console.error('Project not initialized');
        process.exit(1);
    }
    
    config = loadReproConfig();
    sciEnv = config.rw.env.scientific;

    let sci_env_script = '';
    let portSharingCommand = '';
    let volumeSharingCommand = '';
    if (sciEnv=='jupyter') {
        volumeSharingCommand = `-v $(pwd):/home/jovyan `;
        portSharingCommand += `-p $RW_SCIENV_LOCAL_PORT:8888 `;
    } else if (sciEnv=='python') {
        volumeSharingCommand = `-it -v $(pwd):/home/pyuser `;
        portSharingCommand += ``;   
    } else if (sciEnv=='rstudio') {
        volumeSharingCommand = `-v $(pwd):/home/rstudio `;
        portSharingCommand += `-p $RW_SCIENV_LOCAL_PORT:8787 `;
    }
    sci_env_script = `docker run --rm ${volumeSharingCommand}${portSharingCommand}rw-${config.rw.env.slug}`;
    
    return sci_env_script;
}



function startVanillaSciEnv(options) {
    
    try {
        const currentDir = process.cwd();
        var config = loadReproConfig();
        var sci_env_script = getSciEnvCommandScript();
        sci_env_script = sci_env_script.replace(/\$\((pwd)\)/g, currentDir);
        const { command, args } = parseCommand(sci_env_script);
        
        // check for -it options and add if not present
        //if (!args.includes('-it')) {
        //    args.unshift('-it');
        //}

        //console.log(`command: ${command}`);
        //console.log(`args: ${args}`);

        (async () => {
            try {
                let localport;
                
                if (options.port) {
                    localport = options.port;
                } else {
                    localport = await findPortForSciEnv(sciEnv);
                }
                app_env_vars = {
                    scienv_local_port: localport
                }
                setNestedProp(config, 'rw.env', app_env_vars, save=true);
               // writeReproConfig(config);

                const sciEnvVars = {
                    RW_SCIENV_LOCAL_PORT: config.rw.env.scienv_local_port,
                    RW_SCIENV_IMAGE_PORT: config.rw.env.scienv_image_port,
                    RW_SCIENV_VOLUME: config.rw.env.scienv_volume
                }
                argsWithENV = replaceEnvVarsInArgs(args, sciEnvVars);

                // Construct the full command
                const commandWithENV = `${command} ${argsWithENV.join(' ')}`;

                const output = execSync(commandWithENV, { stdio: 'inherit' });
                console.log(output.toString());

            } catch (error) {
                console.error('Error:', error);
            }
        })();

        
    } catch (err) {
        console.error(`Error running develop script: ${err.message}`);
        process.exit(1);
    }
}


function sciEnvCommand(options) {


    if (!fs.existsSync(rwConfigPath)) {
        console.error('reproduce.work: Project not initialized; run "rw init --sci-env=<environment>" first');
        process.exit(1);
    }
    
    const config = loadReproConfig();
    const projectSlug = config.rw.env.slug;

    // use dockerode to check for existence of rw-${config.rw.env.slug} image
    const dockerConnectionOptions = utils.getDockerConnectionOptions();
    const docker = new Docker(dockerConnectionOptions);
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
                return container.Image === `rw-${projectSlug}`;
            });
    
            if (projectContainerRunning) {
                console.log(`Project environment (${projectSlug}) is already running; start a new instance? (y/n)`);
                process.stdin.resume();
                process.stdin.setEncoding('utf8');
                process.stdin.on('data', function (text) {
                    if (text === 'y\n') {
                        console.log('Keep in mind all running instances of project environment act on the same local files.');
                        startVanillaSciEnv(options);
                    } else if (text === 'n\n') {
                        process.exit(1);
                    }
                });
                //continue with starting new instance                


            } else {
                startVanillaSciEnv(options);
            }
        }
    });

}

module.exports = {getSciEnvCommandScript,sciEnvCommand};

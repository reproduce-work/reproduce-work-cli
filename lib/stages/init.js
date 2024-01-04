const path = require('path');
const fs = require('fs');
const prompts = require('prompts');
const toml = require('@iarna/toml');
const {
    rwConfigPath, reproDir, reproPath,
    checkDependencies, loadReproConfig, setNestedProp,
    generateSlug, writeReproConfig, formatFilesInConfig, getValueByKey
} = require('../utils');
const { getSciEnvCommandScript } = require('./sciEnv');
//const { getAssembleCommandScript } = require('./assemble');
//const { getDevelopCommandScript } = require('./develop');
const currentPath = process.cwd();
const validSciEnvs = ['jupyter', 'python', 'rstudio']; 


async function initCommand(options) {
    checkDependencies();
    let sciEnv;
    let successMsg = '';

    // Validate the scientific environment option
    if (!validSciEnvs.includes(options.sciEnv)) {
        console.error(`Invalid scientific environment: ${options.sciEnv}`);
        console.error(`Valid options are: ${validSciEnvs.join(', ')}`);
        process.exit(1);
    }

    const isSciEnvFlagSetManually = process.argv.includes('-s') || process.argv.includes('--sci-env');
    if (!isSciEnvFlagSetManually) {
        successMsg = `Initializing reproducible project with default environment: --sci-env=${options.sciEnv}`;
    } else {
        successMsg = `Initializing reproducible project with environment: --sci-env=${options.sciEnv}`;
    }
    
    sciEnv = options.sciEnv;
    const force_new = options.force;
    //let repository = options.repo;
    //const docEnv = options.docEnv;

    config = loadReproConfig(allow_null=true);

    let old_slug;
    if(Object.keys(config).length > 0){
        old_slug = config.rw.env.slug;
        if(!force_new){
            console.error(`reproduce.work: Project already initialized (${old_slug}). To start with fresh config, use the --force (-f) flag.`);
            process.exit(1);
        } else {
            console.log(`--force=true: Overwriting existing project at ${currentPath} (${old_slug})`);
            fs.rmSync(reproPath, { recursive: true });
        }
    }
    let new_slug;
    new_slug = generateSlug();
    // Sample code data for initializing empty projects
    const base_data = {
        slug: new_slug,
        containerization: 'docker',
        scientific: sciEnv
    };
    //rwConfigData = {}
    setNestedProp(config, 'rw.env', base_data, save=false);

    if (!fs.existsSync(rwConfigPath)) {        

        const gitignoreContent = `.ipython*
.jupyter*
.npm*
.local*
.cache*
.config*
*.ipynb_checkpoints*
!.gitignore
!${reproDir}`
        const gitignorePath = path.join(currentPath, '.gitignore');
        fs.writeFileSync(gitignorePath, gitignoreContent);


    }

    /* if reproduce dir doesn't exist*/
    if (!fs.existsSync(reproPath)) {
        // Create project directory
        try {
            fs.mkdirSync(reproPath, { recursive: true });
        } catch (err) {
            console.error(`Error creating project directory at ${reproPath}: ${err.message}`);
            process.exit(1);
        }
        
    }
    
    // if reproduce/pubdata.toml doens't exist
    //if (!fs.existsSync(rwDataPath)) {
    //    fs.writeFileSync(rwDataPath, '');
    //}

    let run_initialize = false;
    // if reproduce/sci.env doesn't exist
    if (!fs.existsSync(rwConfigPath)) {
        run_initialize = true;
    } 
    
    if (run_initialize || force_new){
        
        //fs.writeFileSync(rwConfigPath, toml.stringify(rwConfigData));
        writeReproConfig(config);
        //config = loadReproConfig();

    
        // should check basic sci.env structure here for required fields
        // and raise error if not present
        required_keys = ['rw', 'rw.env.slug', 'rw.env.containerization', 'rw.env.scientific']
        for (const key of required_keys) {
            if (!getValueByKey(config, key)) {
                console.log(config);
                console.error(`reproduce.work: config failed validation; required key "${key}" not found in sci.env`);
                process.exit(1);
            }
        }


            
        const projectDockerfile = path.join(reproDir, 'Dockerfile');
        const projectDockerComposeFile = path.join(reproDir, 'app.yml');
        let projectBuildCommand = '';
        
        if (sciEnv == 'jupyter') {
        // BASE JUPYTER SCIENV
            
            //check for requirements.txt and create if not exists
            requirementsContent = `# Add your project's Python package dependencies on separate lines
numpy
pandas


## To make build these dependencies into your environment persistently:
## After making any edits to this file, kill your current environment (Ctrl+C),
## rebuild the project using "rw build", and relaunch your environment ("rw launch")
`
            const requirementsFile = path.join(currentPath, reproDir, 'requirements.txt');
            if (!fs.existsSync(requirementsFile)) {
                fs.writeFileSync(requirementsFile, requirementsContent);
            }



            if (!fs.existsSync(projectDockerfile)) {    
                dockerContent = `FROM ghcr.io/reproduce-work/scienv-jupyter:latest
COPY --chown=\${NB_UID}:\${NB_GID} ${reproDir}/requirements.txt /tmp/
RUN pip install --quiet --no-cache-dir --requirement /tmp/requirements.txt
USER root
RUN fix-permissions /home/jovyan
USER \${NB_UID}
WORKDIR /home/jovyan`
                fs.writeFileSync(projectDockerfile, dockerContent);
            }



            projectBuildCommand = `docker pull ghcr.io/reproduce-work/scienv-jupyter:latest
docker build --no-cache -t rw-${config.rw.env.slug} -f ${projectDockerfile} .`

            
            app_env_vars = {
                scienv_image_port: 8888, 
                scienv_volume: '/home/jovyan'
            }
            setNestedProp(config, 'rw.env', app_env_vars);
            //writeReproConfig(config);
        


        } else if (sciEnv == 'python') {

            //check for requirements.txt and create if not exists
            const requirementsFile = path.join(currentPath, reproDir, 'requirements.txt');
            if (!fs.existsSync(requirementsFile)) {
                requirementsContent = `# Add your project's Python package dependencies on separate lines
numpy
pandas


## To make build these dependencies into your environment persistently:
## After making any edits to this file, kill your current environment (Ctrl+C),
## rebuild the project using "rw build", and relaunch your environment ("rw launch")

`
                fs.writeFileSync(requirementsFile, requirementsContent);
            }

            if (!fs.existsSync(projectDockerfile)) {    
                dockerContent = `FROM python:3.11
RUN groupadd -r scigroup && useradd -m -r -g scigroup pyuser
WORKDIR /home/pyuser
COPY --chown=pyuser:scigroup ${reproDir}/requirements.txt /tmp/
RUN pip install --quiet --no-cache-dir --requirement /tmp/requirements.txt
RUN chown -R pyuser:scigroup /home/pyuser
USER pyuser
CMD ["bash"]              
`
                fs.writeFileSync(projectDockerfile, dockerContent);
            }

            projectBuildCommand = `docker pull python:3.11
docker build --no-cache -t rw-${config.rw.env.slug} -f ${projectDockerfile} .`

            app_env_vars = {
                scienv_image_port: 8888, // 8888 left forwarded by default
                scienv_volume: '/home/pyuser'
            }
            setNestedProp(config, 'rw.env', app_env_vars);
            //writeReproConfig(config);


        } else if (sciEnv == 'rstudio') {
        // BASE RSTUDIO SCIENV

            //check for packages.R and create if not exists
            const packagesFile = path.join(currentPath, reproDir, 'packages.R');
            if (!fs.existsSync(packagesFile)) {
                packagesContent = `# Project's R package dependencies
install.packages("ggplot2") 
#install.packages("dplyr") # Uncomment lines to install packages
# ... add more packages as needed

# If you need to install packages from GitHub or other sources, use devtools or remotes
# install.packages("devtools")
# devtools::install_github("user/package")


## To make build these dependencies into your environment persistently:
## After making any edits to this file, kill your current environment (Ctrl+C),
## rebuild the project using "rw build", and relaunch your environment ("rw launch")
`
                fs.writeFileSync(packagesFile, packagesContent);
            }
     
            if (!fs.existsSync(projectDockerfile)) {
                const dockerContent = `FROM rocker/rstudio:latest
COPY ${reproDir}/packages.R /tmp/
RUN Rscript /tmp/packages.R
ENV DISABLE_AUTH=true`
                fs.writeFileSync(projectDockerfile, dockerContent);
            }

            projectBuildCommand = `docker pull rocker/rstudio:latest
docker build --no-cache -t rw-${config.rw.env.slug} -f ${projectDockerfile} .`

            
            app_env_vars = {
                scienv_image_port: 8787, 
                scienv_volume: '/home/rstudio'
            }
            setNestedProp(config, 'rw.env', app_env_vars);
            //writeReproConfig(config);

        
        } else {
            console.error(`Scientific environment ${sciEnv} not supported; current options are: jupyter, python, rstudio`);
            process.exit(1);
        }

        let proxyImageBuildCommand = '';
        let proxyAppLaunchCommand = '';
        // Add options for the reproduce.work proxy user interface
        //if (!options.vanillaEnv) {
        if (false) {
            if (!fs.existsSync(projectDockerComposeFile)) {    
                dockerComposeContent = `version: '3.8'
services:
  rw-proxy:
    image: ghcr.io/reproduce-work/rw-cli-app:latest
    ports:
      - "8080:80"
    volumes:
      - ./:/usr/share/nginx/_rwproj/
    depends_on:
      - rw-target
    networks:
      - rw_network

  rw-target:
    image: rw-${new_slug}
    ports:
      - "$RW_SCIENV_LOCAL_PORT:$RW_SCIENV_IMAGE_PORT"
    volumes:
      - ../:$RW_SCIENV_VOLUME
    networks:
      - rw_network

networks:
    rw_network:
`
                fs.writeFileSync(projectDockerComposeFile, dockerComposeContent);
            }

            proxyImageBuildCommand = '\ndocker pull ghcr.io/reproduce-work/rw-cli-app:latest'
            proxyAppLaunchCommand = `docker-compose -p reproduce-${new_slug} -f $(pwd)/${projectDockerComposeFile} up;`;
            
        }

        // BUILD
        build_script  = `${projectBuildCommand}${proxyImageBuildCommand}`
        config = loadReproConfig();
        setNestedProp(config, 'stage.build.script', build_script);
        writeReproConfig(config); // Save changes

        // RUN SCIENV
        const sci_env_script = getSciEnvCommandScript();
        //setNestedProp(config, 'stage.scienv.script', sci_env_script);
        //writeReproConfig(config); // Save changes

        // LAUNCH
        //const launchScript = `${proxyAppLaunchCommand}`
        //setNestedProp(config, 'stage.launch.script', launchScript);
        setNestedProp(config, 'stage.launch.script', sci_env_script);
        writeReproConfig(config); // Save changes

        // ...
        // // // DEVELOP
        //const dev_script = getDevelopCommandScript();
        //setNestedProp(config, 'stage.develop.script', dev_script);

        // // // ASSEMBLE
        //const assemble_script = getAssembleCommandScript(docEnv);
        //setNestedProp(config, 'stage.assemble.script', assemble_script);

        // // // PUBLISH
        // tbd
        
        
    }

    if (run_initialize && !force_new) {
        // add to string
        successMsg += ` (${new_slug})`;
        console.log(successMsg);
    } else if (force_new) {
        //console.log(`--force=true: Overwriting existing project at ${currentPath}`);
        successMsg += ` (${new_slug})`;
        console.log(successMsg);
    } else {
        console.log(`Project already initialized at ${currentPath}: ${config.rw.env.slug}; use --force (-f) flag to overwrite.`);
    }

}

module.exports = {initCommand, validSciEnvs};
#!/usr/bin/env node

const ora = require('ora');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const glob = require('glob');
const toml = require('@iarna/toml');
const project_base = process.cwd();//path.join('/home', 'node');
const reproDir = process.env.REPROWORKDIR || 'reproduce';
const net = require('net');
const blessed = require('blessed');


function getValueByKey(object, keyString) {
  const keys = keyString.split('.');
  let value = object;

  for (const key of keys) {
    if (value.hasOwnProperty(key)) {
      value = value[key];
    } else {
      return null; // Return null if any part of the key is not found
    }
  }

  return value;
}

function generateSlug() {
  const timestamp = Date.now().toString(36);
  const randomNumber = Math.floor(Math.random() * 100000000).toString(36);
  const combinedString = timestamp + randomNumber;
  return combinedString.substring(0, 8);
}


function currentProjectDir() {
  const cwd = process.cwd();
  
  let dir = cwd;
  while (dir !== '/') {
    const reproPath = path.join(dir, reproDir);
    if (fs.existsSync(reproPath)) {
      return reproPath;
    }
    dir = path.dirname(dir);
  }
  return null;
}

const rwConfigPath = path.join(project_base, reproDir, 'sci.env');
const reproPath = path.join(project_base, reproDir); 

function checkDocker() {
  try {
    execSync('docker --version', { stdio: 'ignore' });
  } catch (error) {
      console.error('reproduce.work: Docker is required to run this tool');
      console.error('Please install Docker before installing this tool');
      console.error('Instructions for installing Docker can be found at https://docs.docker.com/get-docker/');
    process.exit(1);
  }
}


function findDockerPath() {
  // Split the PATH variable to get an array of directories
  const pathDirs = process.env.PATH.split(path.delimiter);

  // Check each directory for the Docker executable
  for (const dir of pathDirs) {
    const fullPath = path.join(dir, 'docker');
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  // Return null or throw an error if Docker is not found
  return null;
}


function getContainerIdByTag(tag) {
  try {
      // Run 'docker ps' command and get the output
      const result = execSync('docker ps --format "{{.ID}} {{.Image}}"').toString();

      // Split the output into lines
      const lines = result.split('\n');

      // Iterate through each line to find a matching tag
      for (const line of lines) {
          const [containerId, image] = line.split(' ');
          if (image && image.includes(tag)) {
              return containerId;
          }
      }

      return null; // Return null if no container with the specified tag is found
  } catch (error) {
      console.error('Error fetching container ID:', error);
      throw error;
  }
}



function checkGit() {
  try {
    execSync('git --version', { stdio: 'ignore' });
  } catch (error) {
    console.error('Git is not installed');
    process.exit(1);
  }
}

function checkDependencies() {
  checkDocker();
  //checkGit();
}

function setNestedProp(obj, path, value, save=false) {

  let need_to_format;
  // check if value is numeric and greater than 1000 in abs
  if (typeof value === 'number' && Math.abs(value) > 1000) {
    need_to_format = true;
  }

  const keys = path.split('.');
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }

  if(need_to_format){
    // format as string with no underscores 
    value = value.toString().replace(/_/g, '');
    //convert to int
    value = parseInt(value);
  }
  current[keys[keys.length - 1]] = value;

  if (save) {
    writeReproConfig(obj);
  }
}

function loadReproConfig(allow_null=false) {
  
  let config = {}; // Define config with an initial empty object

  try {
    // check if exists 
    if (!fs.existsSync(rwConfigPath)) {
      // no existing config
      if (allow_null) {
        return {};
      } else {
        console.error(`reproduce.work: No existing config found at ${rwConfigPath}`);
        process.exit(1);
      }
    }

    const rwConfigContent = fs.readFileSync(rwConfigPath, 'utf8');
    config = toml.parse(rwConfigContent); // Assign the parsed config here
  } catch (error) {
    
    console.log(`reproduce.work: Error loading config at ${rwConfigPath}`);
  }

  return config;
}

const writeFileRecursive = (file, data) => {
  const dirname = path.dirname(file);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }
  fs.writeFileSync(file, data);
};

function writeReproConfig(config) {
  try {

    // Convert the config object to a TOML string
    const tomlStr = toml.stringify(config);
    
    // Trim whitespace from each line
    let cleanedTomlStr = tomlStr.split('\n').map(line => line.trim()).join('\n');
    
    // Rewrite the repro.files.watch entry onto a single line
    const watchPattern = /(\[repro\.files\][^\[]*?)watch\s*=\s*\[\s*((?:(?:"[^"]+",?\s*)+))\s*\]/gs;
    cleanedTomlStr = cleanedTomlStr.replace(watchPattern, (match, precedingText, watchValues) => {
        const singleLineValues = watchValues.replace(/\s+/g, ' ');
        return `${precedingText}watch = [ ${singleLineValues} ]`;
    });

    
    // Write the cleaned TOML string to the specified path
    writeFileRecursive(rwConfigPath, cleanedTomlStr);
    
  } catch (error) {
    console.error(`Error writing config file: ${error}`);
    process.exit(1);
  }
}

function formatFilesInConfig(config) {

  if (!config){
      config = loadReproConfig();
  } else {
      config = config;
  }

  sciEnv = config.rw.env.scientific;
  docEnv = config.rw.env.report;


  if (docEnv == 'markdown-latex') {
      input = "report/main.md"
      dynamic = "reproduce/pubdata.toml"
      template = "report/latex/template.tex"
      auxfile = "report/latex/bibliography.bib"
      output_linefile = "report/latex/report.tex"
      output_report = "report/compiled.pdf"
  } else if (docEnv == 'notebook-latex') {
      input = "report/main.ipynb"
      dynamic = "reproduce/pubdata.toml"
      template = "report/latex/template.tex"
      auxfile = "report/latex/bibliography.bib"
      output_linefile = "report/latex/report.tex"
      output_report = "report/compiled.pdf"
  } else if (docEnv == 'notebook-html') {
      input = "report/main.ipynb"
      dynamic = "reproduce/pubdata.toml"
      template = "report/html/template.html"
      auxfile = "report/html/bibliography.bib"
      output_linefile = "report/compiled.html"
      output_report = "report/compiled.html"
  } else if (docEnv == 'docx') {
      input = "report/main.docx"
      dynamic = "reproduce/pubdata.toml"
      template = "report/docx/template.docx"
      auxfile = "report/docx/bibliography.bib"
      output_linefile = "report/compiled.docx"
      output_report = "report/compiled.docx"
  } else {
      console.error(`Error in formatFilesInConfig: report environment ${docEnv} not recognized`);
      process.exit(1);
  }

  /*
  if (sciEnv == 'jupyter') {
      
  } else if (['python', 'R', 'RStudio'].includes(sciEnv)) {
    
  } else { 

  }
  */
  watchFiles = [input, dynamic, template, auxfile]
  
  repro_files_data = {
      code_dir: "code",
      //private_dir: "private",
      input: input,
      dynamic: dynamic,
      template: template,
      bibfile: auxfile,
      output_linefile: output_linefile,
      output_report: output_report,
      watch: watchFiles
  }

  //console.log(config)
  setNestedProp(config, 'repro.files', repro_files_data);
  //console.log(config)
  writeReproConfig(config, rwConfigPath);

  return config;
}

function findScripts(envType, fileExtension, defaultPattern, patternArray=["scripts/*"], commentLine='') {
  let scriptArray = patternArray;
  if (!scriptArray) {
      scriptArray = [defaultPattern];
  }

  scriptArray.forEach(pattern => {
      const scripts = glob.sync(pattern);

      scripts.forEach(script => {
          if (fs.lstatSync(script).isDirectory()) {
              const files = fs.readdirSync(script);
              files.forEach(file => {
                  if (file.endsWith(fileExtension)) {
                      fs.mkdirSync(path.dirname(path.join(reproPath, path.join(script, file))), { recursive: true });
                  }
              });
          } else if (script.endsWith(fileExtension)) {
              fs.mkdirSync(path.dirname(path.join(reproPath, script)), { recursive: true });

              const scriptFile = path.join(reproPath, script);
              if (!fs.existsSync(scriptFile)) {
                  fs.writeFileSync(scriptFile, commentLine);
              }
          }
      });
  });
}


function checkPort(port) {
  return new Promise((resolve, reject) => {
      const server = net.createServer();

      server.listen(port, () => {
          server.close(() => resolve(port));
      });

      server.on('error', (err) => {
          if (err.code === 'EADDRINUSE') {
              reject('');
          } else {
              reject(err);
          }
      });
  }); 
}

async function findAvailablePort(startingPort) {
  let currentPort = startingPort;
  while (true) {
      try {
          const availablePort = await checkPort(currentPort);
          return availablePort;
      } catch (error) {
          console.log(error);
          currentPort++;
      }
  }
}

async function findPortForSciEnv(sciEnv) {
  try {
    let defaultPort;
    let foundPort;

    switch (sciEnv) {
        case 'rw-proxy':
          defaultPort = 8080;
          break
        case 'jupyter':
            defaultPort = 8888;
            break
        case 'rstudio':
            defaultPort = 8787;
            break
        default:
            return null;
    }
    foundPort = await findAvailablePort(defaultPort);
    return foundPort;

  } catch (error) {
      console.error(error);
  }
}


function formatHyperlink(url) {
  return url.trim()
  //return `\x1b]8;;${url}\x1b\\${url}\x1b]8;;\x1b\\`;
}


let screen, sciEnvTitleBox, sciEnvLogBox, rwTitleBox, rwLogBox;

function initScreen(config, sciEnvContainer) {

    let sciEnv = config.rw.env.scientific;

    screen = blessed.screen({
        smartCSR: true,
        title: 'reproduce.work CLI'
    });

    sciEnvTitleBox = blessed.box({
        top: '0%',
        left: '0%',
        width: '100%',
        height: '3%',
        valign: 'middle',
        content: `sci-env (${sciEnv})`,
        align: 'center',
        style: {
            fg: 'black',
            bg: 'white',
            bold: true
        }
    });

    sciEnvLogBox = blessed.box({
        top: '3%',
        left: '0%',
        width: '100%',
        height: '72%',
        content: '',
        scrollable: true,
        mouse: true, // Enable mouse events
        keys: true, // Enable keyboard interaction
        alwaysScroll: true,
        scrollbar: {
            ch: ' ',
            inverse: true
        },
        border: {
            type: 'line',
            size: 1
        },
        style: {
            fg: 'white',
            bg: 'black',
            border: {
                fg: '#f0f0f0'
            }
        }
    });

    rwTitleBox = blessed.box({
        top: '75%',
        left: '0%',
        width: '100%',
        height: '3%',
        valign: 'middle',
        content: 'reproduce.work',
        align: 'center',
        style: {
            fg: 'black',
            bg: 'white',
            bold: true
        }
    });

    rwLogBox = blessed.box({
        top: '77%',
        left: '0%',
        width: '100%',
        height: '23%',
        content: 'To shut down the scientific environment, focus this terminal and press Ctrl+C.',
        scrollable: true,
        mouse: true, // Enable mouse events
        keys: true, // Enable keyboard interaction
        border: {
            type: 'line',
            size: 1
        },
        style: {
            fg: 'white',
            bg: 'black',
            border: {
                fg: '#f0f0f0'
            }
        }
    });

    screen.append(sciEnvTitleBox);
    screen.append(sciEnvLogBox);
    screen.append(rwTitleBox);
    screen.append(rwLogBox);

    let quit_timeout; 
    // Function to clear the screen and show a graceful shutdown message
    function showShutdownMessage() {

      // Start checking Docker containers
      pollProejctContainersStatus(quit=true);

      // Stop spinner and clear interval after 5 seconds
      quit_timeout = setTimeout(() => {
        screen.destroy();
        process.exit(0);
      }, 5000); // Adjust time as needed
    }

    // Function to check the Docker containers
    function pollProejctContainersStatus(quit=false) {
      let spinner_interval; 
      let polling_interval;

      polling_interval = setInterval(() => {
          docker.listContainers({ all: true }, function (err, containers) {
              if (err) {
                  console.error('Error listing containers:', err);
                  clearInterval(polling_interval);
                  return;
              }

              let allStopped = containers.every(container => {
                  return !(container.Names.some(name => name.includes(`reproduce-${config.rw.env.slug}`)) && container.State === 'running');
              });

              if (allStopped) {
                  console.log('All targeted containers have stopped.');
                  if (spinner_interval){
                    clearInterval(spinner_interval);
                    clearInterval(quit_timeout);
                  }

                  // shut down the screen
                  if(quit){

                    console.log("Shutting down gracefully!!!")
                    screen.children.forEach(child => child.detach());

                    // Start ora spinner
                    let spinner = ora({
                      text: ' ',
                      spinner: 'moon'
                    }).start();

                    const shutdownContent = `Shutting down gracefully\n\n${spinner.frame()}`

                    let shutdownMsg = blessed.box({
                        top: 'center',
                        left: 'center',
                        width: '50%',
                        height: '10%',
                        content: shutdownContent,
                        border: { type: 'line' },
                        style: { border: { fg: 'green' } }
                    });
                    screen.append(shutdownMsg);
                    

                    // Update the screen every 100ms to animate the spinner
                    spinner_interval = setInterval(() => {
                        screen.render();
                    }, 100);
                  }
              } else {
                  console.log('Some targeted containers are still running...');
              }
          });
      }, 25); // Check every .025 seconds, adjust as needed
    }

    
    screen.key(['q', 'C-c'], (ch, key) => {
        
      showShutdownMessage();  
      // if sciEnv in jupyter, rstudio
      if (['jupyter', 'rstudio'].includes(sciEnv)) {
        //execSync(`docker-compose -p reproduce-${config.rw.env.slug} stop`);
        const containerId = getContainerIdByTag(`rw-${config.rw.env.slug}`);
        execSync(`docker stop ${containerId}`);
      } else {
        // Check if the sciEnvContainer is provided and is a valid process
        if (sciEnvContainer && typeof sciEnvContainer.kill === 'function') {
          sciEnvContainer.kill('SIGTERM'); // Or 'SIGINT' if that's more appropriate
        }
      }
      return process.exit(0);
    });

    // Ensure the box is focused to receive input
    sciEnvLogBox.focus();

    // Render the screen after focusing
    screen.render();

    // Handle scroll events for the box
    sciEnvLogBox.on('scroll', () => {
        screen.render();
    });

    // Handle scroll events for the box
    rwLogBox.on('scroll', () => {
        screen.render();
    });

    // Listen for keys to scroll, for example, up and down arrows
    screen.key(['up'], () => {
        sciEnvLogBox.scroll(-1); // Scroll up
        screen.render();
    });

    screen.key(['down'], () => {
        sciEnvLogBox.scroll(1); // Scroll down
        screen.render();
    });

    return screen;
}

function updateSciLog(content) {
    sciEnvLogBox.setContent(`${sciEnvLogBox.getContent()}${content}`);
    sciEnvLogBox.setScrollPerc(100);
    screen.render();
}

function updateRWLog(content) {
  rwLogBox.setContent(`${rwLogBox.getContent()}${content}`);
  rwLogBox.setScrollPerc(100);
  screen.render();
}



function parseCommand(fullCommand) {
  const [command, ...args] = fullCommand.split(/\s+/);
  return { command, args };
}


function replaceEnvVarsInArgs(args, sciEnvVars) {
  return args.map(arg => {
      return arg.replace(/\$(\w+)/g, (match, envVar) => {
          // Check if the environment variable exists in sciEnvVars
          if (sciEnvVars.hasOwnProperty(envVar)) {
              return sciEnvVars[envVar];
          } else {
              // If the variable is not found, leave the placeholder as is
              return match;
          }
      });
  });
}

module.exports = {
  reproDir,
  reproPath,
  rwConfigPath,
  getValueByKey,
  currentProjectDir,
  checkDocker,
  findDockerPath,
  checkGit,
  checkDependencies,
  setNestedProp,
  loadReproConfig,
  writeReproConfig,
  formatFilesInConfig,
  findScripts,
  //rootPath,
  generateSlug,
  findAvailablePort,
  findPortForSciEnv,
  parseCommand,
  formatHyperlink,
  initScreen,
  updateSciLog,
  updateRWLog,
  replaceEnvVarsInArgs
};

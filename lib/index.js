#!/usr/bin/env node
const { program, Command } = require('commander');

// Import utility functions from utils.js
//const {} = require('./utils');

// Import reproduction stages from stages.js

//const assembleCommand = require('./stages/run');
//const publishCommand = require('./stages/publish');
//const {developCommand} = require('./stages/develop');

const {initCommand, validSciEnvs} = require('./stages/init');
const {buildCommand} = require('./stages/build');
const {sciEnvCommand} = require('./stages/sciEnv');
const {launchCommand} = require('./stages/launch');
const {startBlessedInterface} = require('./ux');

const init_command = new Command('init')
    .description('Initialize a new reproduce.work project in the current directory.')
    .option('-s, --sci-env <env>', `set the scientific environment (${validSciEnvs.join(', ')})`, 'jupyter')
    .option('-f, --force', 'force new config', false)
    .action(options => initCommand(options));
program.addCommand(init_command);

const build_command = new Command('build')
    .description("Downloads dependencies and installs them inside a containerized scientific environment")
    .option('--no-cache', 'Download dependencies from the web without using locally cached versions', false)
    .option('-v, --verbose', "Prints to console the output of your project's build process", false)
    .action(options => buildCommand(options));
program.addCommand(build_command);

/*
const sci_env_command = new Command('sci-env')
    .description('Opens the vanilla version of your scientific computing environment (without the reproduce.work applicaiton layer)')
    .option('-p, --port <port>', 'set local port for the jupyter server manually; otherwise an open port will be found automatically', null)
    .option('-o, --open', 'Opens the scientific environment in your default browser', false)
    .action(options => sciEnvCommand(options));
program.addCommand(sci_env_command);
*/

const launch_command = new Command('launch')
    .description('Launches your scientific computing environment')
    .option('-p, --port <port>', 'set local port for the jupyter server manually; otherwise an open port will be found automatically', null)
    //.option('-w, --watch <true,false>', 'Automatically executes "run" script whenever watched files are changed; default to true', true)
    .option('-o, --open', 'Opens the scientific environment in your default browser', false)
    .action(options => launchCommand(options));
program.addCommand(launch_command);

const quickStartCommand = new Command('quickstart')
    .description('Initialize, build, and launch a project in one command')
    .argument('<sci-env>', `set the scientific environment (${validSciEnvs.join(', ')})`)
    .option('-f, --force', 'force new config', false)
    .action(async (sciEnv, options) => {
        options.sciEnv = sciEnv;
        await initCommand({ ...options, force: options.force || false });
        await buildCommand(options);
        await launchCommand(options);
    });
//program.addCommand(quickStartCommand);


/*
const develop_command = new Command('develop')
    .description('Launches scientific computing environment with optional watcher (default: --watch=true) that compiles report using specified document environment')
    .option('-p, --port <port>', 'set local port for the jupyter server manually; otherwise an open port will be found automatically', null)
    .option('-w, --watch <true,false>', 'Automatically executes "run" script whenever watched files are changed; default to true', true)
    .option('-s, --sci-v', 'Prints to console the STDOUT/STDERR of your scientific environemnt', false)
    .option('-d, --doc-v', 'Prints to console the STDOUT/STDERR of your document environemnt', false)
    .action(options => developCommand(options));
program.addCommand(develop_command);


const run_command = new Command('run')
    .description('buildialize a new project')
    //.argument('<name>')
    .action(assembleCommand);
program.addCommand(run_command);

const publish_command = new Command('publish')
    .description('buildialize a new project')
    //.argument('<name>')
    .action(publishCommand);
program.addCommand(publish_command);
*/

/*
const uxCommand = new Command('ux')
    .description('Interactive UX for reproduce.work CLI')
    .action(() => {
        startBlessedInterface();
    });
program.addCommand(uxCommand);
*/

function main() {
  program
    .version('0.0.1')
    .description('reproduce.work: CLI tool for containerized scientific projects')
    .parse(process.argv);
}
module.exports = main;
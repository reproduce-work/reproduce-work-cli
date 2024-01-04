const { exec } = require('child_process');
const ora = require('ora');
const {
  loadReproConfig
} = require('../utils');

function buildCommand(options) {
  //console.log(options);

  config = loadReproConfig();
  sciEnv = config.rw.env.scientific;
  //docEnv = config.rw.env.report;

  var build_script = config.stage.build.script;
  //console.log(build_script);

  // define variable that is true if config.stage.build.script,
  // config.stage.assemble.script, and config.stage.develop.script
  // are all defined
  const stage = config.stage;
  const defaultScripts = {
    build: null,
    assemble: null,
    develop: null,
    publish: null,
  };

  const definedScripts = {};

  for (const subkey in defaultScripts) {
    definedScripts[subkey] = stage?.[subkey]?.script || defaultScripts[subkey];
  }

  // Now you can access the defined scripts using definedScripts object
  const buildDefined = definedScripts.build;

  if (!buildDefined) {
    console.error("Error: No build script defined in sci.env; run `rw init` to initialize a new project.");
    process.exit(1);
  }

  // execute build command  
  try {
      if (options.cache) {
        // remove the --no-cache flag from build_script
        build_script = build_script.replace(' --no-cache', '');
      }
      //console.log(build_script);

      //(async () => {
          let spinner;
          let timeout;
          //let ora; 

          if (!options.verbose) {
              //ora = (await import('ora')).default;
              // Start the spinner only if verbose is false
              spinner = ora({
                  text: `Building scientific environment (${sciEnv})...`,
                  color: 'white',
                  spinner: 'material'
              }).start();
          }

          const child = exec(build_script);

          if (!options.verbose) {

            // Set a timeout to print a message after 5 seconds
            timeout = setTimeout(() => {
              spinner.stop();
              console.log('\nIf building for the first time or using the --no-cache flag, this may take several minutes; use the --verbose flag to see the output of your build script instead of a spinner.\n');
              spinner.start();
            }, 5000);

          } else {
              // If verbose, pipe the output directly
              child.stdout.pipe(process.stdout);
              child.stderr.pipe(process.stderr);
          }

          child.on('close', (code) => {
              if (spinner) {
                  spinner.stop();
              }
              if (code !== 0) {
                  console.error(`Build script failed; exited with code ${code}`);
              } else {
                  console.log(`Successfully built images for current project (${config.rw.env.slug}).`);
                  clearTimeout(timeout);
                  
              }
          });

          child.on('error', (error) => {
              if (spinner) {
                  spinner.fail();
              }
              console.error(`Error: ${error}`);
          });
      
      /*
      })().catch(error => {
          console.error('Error importing ora:', error);
      });
      */

  } catch (err) {
      console.error(`Error running build script: ${err.message}`);
      process.exit(1);
  }


}



module.exports = {buildCommand};
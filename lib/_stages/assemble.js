const path = require('path');
const fs = require('fs');
const toml = require('@iarna/toml');
const { execSync } = require('child_process');
const currentPath = process.cwd();


function getAssembleCommandScript(docEnv) {
  if (!docEnv) {
      try {
          docEnv = config.stage.assemble.doc_env;
      } catch {
          console.log('Setting report environment to default (markdown-latex)')
          docEnv = 'markdown-latex';
      }
  }
  const reproDir = getDefaultReproDirprocess.env.REPROWORKDIR || '.reproduce';
  const configFile = path.join(currentPath, reproDir, 'config.toml');
  if (!fs.existsSync(configFile)) {
    console.error('Config file not found');
    process.exit(1);
  }
  const configContent = fs.readFileSync(configFile, 'utf8');
  const config = toml.parse(configContent);
  
  let command;
  try {
      command = config.stage.assemble.script;
  } catch {
      command = null;
  }

  if (docEnv=='markdown-latex') {
    command = `if [ ! -d '${reproDir}/tmp/' ]; then
  mkdir ${reproDir}/tmp/
fi
cp -r report ${reproDir}/tmp/
docker run --rm -v $(pwd):/home -e REPROWORKDIR='${reproDir}' rw-prepare-doc python /run.py
docker run --rm -v $(pwd):/home rw-compile-doc sh -c 'cd /home/${reproDir}/tmp/report/latex && xelatex report.tex && bibtex report'
cp ${reproDir}/tmp/report/latex/report.tex report/latex/report.tex
cp ${reproDir}/tmp/report/latex/report.pdf report/compiled.pdf`;

  } else if (docEnv=='html') {
    command = `docker run rw-${config.rw.env.slug}
if [ ! -d "${reproDir}/tmp/" ]; then
  mkdir ${reproDir}/tmp/
fi
cp report/* ${reproDir}/tmp/
cd ${reproDir}/tmp/html/
docker run --rm -v /usr/src/app:/home rw-prepare-doc
docker run --rm -v /usr/src/app:/home rw-compile-doc sh -c "cd ${reproDir}/tmp/html && jupyter nbconvert --to html report.ipynb"
cp ${reproDir}/tmp/html/report.html report/compiled.html
`;
  } else if (docEnv=='docx') {
    command = `docker run rw-${config.rw.env.slug}
if [ ! -d "${reproDir}/tmp/" ]; then
  mkdir ${reproDir}/tmp/
fi  
cp report/* ${reproDir}/tmp/
cd ${reproDir}/tmp/docx/
docker run --rm -v /usr/src/app:/home rw-prepare-doc
docker run --rm -v /usr/src/app:/home rw-compile-doc sh -c "cd ${reproDir}/tmp/docx && pandoc report.docx -o report.docx"
cp ${reproDir}/tmp/docx/report.docx report/compiled.docx
`;

  } else {
    console.error(`Error in getAssembleCommandScript: report environment ${docEnv} not recognized`);
    process.exit(1);
  }

  return command
}

/*
function assembleCommand() {
  command = getAssembleCommandScript(null);
  console.log(`Running command: ${command}`);
  execSync(command, { stdio: 'inherit' });
}
*/

  
// export both functions
module.exports = {
  getAssembleCommandScript,
  //assembleCommand,
};

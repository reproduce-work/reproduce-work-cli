const blessed = require('blessed');
const {loadReproConfig} = require('./utils');
// Function to create two-column options display
function createOptionsBox(screen, options, label) {
    const data = options.map(opt => {
      let valueDisplay = '';
      if (typeof opt.value === 'boolean') {
        valueDisplay = opt.value ? 'true ✅' : 'false ❌';
      } else if (opt.value !== undefined) {
        valueDisplay = opt.value.toString();
      }
      return [opt.name, valueDisplay];
    });
  
    const optionsBox = blessed.listtable({
      parent: screen,
      width: '60%',
      height: '50%',
      top: 'center',
      left: 'center',
      label: ` ${label} Options `,
      border: { type: 'line' },
      align: 'left',
      keys: true,
      mouse: true,
      style: {
        header: { bold: true },
        cell: { selected: { bg: 'green', fg: 'white' }, hover: { bg: 'blue' } },
      },
      data: [['name', 'value'], ...data]
    });
  
    return optionsBox;
}
  
// Modify existing functions to use createOptionsBox
function createInitOptions(screen) {
    const options = [
      { name: '--sci-env <env>', value: 'jupyter' },
      { name: '--force', value: false }
    ];
    const initOptions = createOptionsBox(screen, options, 'init');
    attachOptionEventListeners(initOptions);
}
  
function createBuildOptions(screen) {
    const options = [
      { name: '--no-cache', value: false },
      { name: '--verbose', value: false }
    ];
    const buildOptions = createOptionsBox(screen, options, 'build');
    attachOptionEventListeners(buildOptions);
}
  
function createLaunchOptions(screen) {
    const options = [
      { name: '--port <port>', value: '' },
      { name: '--open', value: false }
    ];
    const launchOptions = createOptionsBox(screen, options, 'launch');
    attachOptionEventListeners(launchOptions);
}
 

  // Generic function to attach event listeners to options boxes
function attachOptionEventListeners(optionsBox) {
    optionsBox.on('select', (item) => {
      // Implement logic for handling option selection
      // e.g., toggle boolean values, prompt for string values
    });
}

// Function to display and navigate config metadata
function displayConfigMetadata(screen, config, path = []) {
    const configData = Object.entries(config).map(([key, value]) => {
        const isObject = typeof value === 'object' && value !== null;
        let valueDisplay = isObject ? `{bold}{#6c71c4-fg}... > {/}{/bold}` : value.toString();
        if (isObject) {
            valueDisplay += Object.keys(value).map(k => `{#839496-fg}${k}{/}`).join(', ');
        }
        return [
            `  ${key}`, 
            valueDisplay
        ];
    });

    const configBox = blessed.listtable({
        parent: screen,
        top: '70%',
        width: '50%',
        height: '10%',
        left: 'center',
        label: ' Configuration ',
        border: { type: 'line' },
        align: 'left',
        keys: true,
        mouse: true,
        tags: true,
        style: {
            header: { bold: true },
            cell: { selected: { fg: 'white' }, hover: { bg: 'blue' } },
        },
        data: [['Key', 'Value'], ...configData]
    });

    // Breadcrumbs
    const breadcrumbPath = path.length > 0 ? path.join('.') : 'root';
    const breadcrumbs = blessed.text({
        parent: screen,
        content: `Path: ${breadcrumbPath}`,
        top: '80%',
        left: 'center',
        height: 'shrink',
        width: '50%',
        style: {
            fg: 'yellow',
            hover: { bg: 'blue' },
        },
        clickable: true,
        mouse: true,
    });

    breadcrumbs.on('click', () => {
        const newPath = breadcrumbPath.split('.').slice(0, -1);
        const newConfig = newPath.reduce((obj, key) => obj[key], { root: config }).root;
        displayConfigMetadata(screen, newConfig, newPath);
    });

    // Navigation instructions
    const instructions = blessed.text({
        parent: screen,
        content: 'Use mouse or arrows, space, and return keys to navigate',
        top: '83%',
        left: 'center',
        height: 'shrink',
        width: '50%',
        style: {
            fg: 'green'
        }
    });

    configBox.on('select', (item, index) => {
        if (index > 0) { // Ignore header row
            const key = item.getText().trim().split('  ')[0];
            const value = config[key];
            if (typeof value === 'object' && value !== null) {
                displayConfigMetadata(screen, value, [...path, key]);
            }
        }
    });

    screen.key(['space'], () => {
        if (path.length > 0 && screen.focused === configBox) {
            const newPath = path.slice(0, -1);
            const newConfig = newPath.reduce((obj, key) => obj[key], { root: config }).root;
            displayConfigMetadata(screen, newConfig, newPath);
        }
    });

    screen.key(['return'], () => {
        if (screen.focused === configBox) {
            const selectedItem = configBox.getItem(configBox.selected);
            if (selectedItem) {
                const key = selectedItem.getText().trim().split('  ')[0];
                const value = config[key];
                if (typeof value === 'object' && value !== null) {
                    displayConfigMetadata(screen, value, [...path, key]);
                }
            }
        }
    });

    screen.append(configBox);
    screen.render();
}



function startBlessedInterface() {
    // Create a blessed screen object
    const screen = blessed.screen({
    smartCSR: true,
    title: 'reproduce-work CLI Tool'
    });

    

    // Quit on Escape, q, or Control-C
    screen.key(['escape', 'q', 'C-c'], () => process.exit(0));

    // Main menu box
    const mainMenu = blessed.list({
        parent: screen,
        width: '50%',
        height: 10,
        top: 'center',
        left: 'center',
        label: ' reproduce.work ',
        border: { type: 'line' },
        style: {
            selected: { bg: 'green' },
            item: { hover: { bg: 'blue' } }
        },
        keys: true,
        mouse: true,
        items: ['init', 'build', 'launch']
    });

    config = loadReproConfig();
    displayConfigMetadata(screen, config);
    

    // Event handler for main menu
    mainMenu.on('select', (item) => {
        const selectedCommand = item.getText();
        handleCommand(selectedCommand);
    });

    

    // Function to handle command selection
    function handleCommand(command) {
        // Clear the main menu
        mainMenu.detach();

        if (command === 'init') {
            createInitOptions(screen);
        } else if (command === 'build') {
            createBuildOptions(screen);
        } else if (command === 'launch') {
            createLaunchOptions(screen);
        }

        screen.render();
    }
    
    // Initial rendering of the screen
    screen.append(mainMenu);
    screen.render();
}

// export both functions
module.exports = {
    startBlessedInterface,
};

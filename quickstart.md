# Quick Start

## Setup
```bash
rw init
```

You will be prompted to enter a remote repository for your project. 

This creates a directory structure like this:

```
# Where analysis code and data should go
code/
  |_ 00_start.ipynb
  |_ requirements.txt

# Where you will author your report/manuscript
report/
  |_ main.md 
  |_ latex/

# Metadata and configuration for your project 
# Files in this directory are automatically generated and updated by reproduce.work
reproduce/
  |_ config.toml
  |_ pubdata.toml
  |_ Dockerfile
```


```bash
rw build
```

## Run

```bash
rw develop
```

By default, this will start a Jupyter Lab server and log the URL to the console.



#### Note!
> Due to idiosyncrasies within the Jupyter ecosystem, when using publish_data or publish_file, you must first run register_notebook('code/<path to this notebook>.ipynb'). If you have multiple notebooks open simultaneously, keep in mind that only the most recently registered notebook will be used as the generating script for any data published with publish_data or publish_file.


### Installing packages

While in the development environment, you can install packages in one of two ways:

- **Persistent**: Add your desired packages on separate lines to `code/requirements.txt` and run `rw build` again. After "building" your dev environment, you can stop and restart it and your packages will be installed.

- **Temporary**: While your dev environment is running, you can use `pip install <package_name>`; however keep in mind that packages installed this way will not persist across sessions (i.e. if you stop and restart your dev environment, you will need to reinstall them). This is suitable for development/testing, but packages that are core to your project should be added to `code/requirements.txt`.
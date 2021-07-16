#!/bin/bash

# VERSION
version='1.0'

# Project name
projectName="NanoDrop Faucet"

# Port to test
port=3000

# OUTPUT VARS
TERM=xterm
red=`tput setaf 1`
green=`tput setaf 2`
yellow=`tput setaf 3`
bold=`tput bold`
reset=`tput sgr0`

# FLAGS & ARGUMENTS
quiet='false'
verbose='true'

# Check if running as root
if [ "$EUID" -ne 0 ]
  then echo "${red}Please run as root: ${reset}${bold}sudo ./build-docker.sh${reset}"
  exit
fi

# PRINT INSTALLER DETAILS
[[ $quiet = 'false' ]] && echo "${green} -----------------------${reset}"
[[ $quiet = 'false' ]] && echo "${green}${bold} ${projectName} ${version}${reset}"
[[ $quiet = 'false' ]] && echo "${green} -----------------------${reset}"
[[ $quiet = 'false' ]] && echo ""

# VERIFY TOOLS INSTALLATIONS
docker -v &> /dev/null
if [ $? -ne 0 ]; then
    echo "${red}Docker is not installed. Please follow the install instructions for your system at https://docs.docker.com/install/.${reset}";
    exit 2
fi

docker-compose --version &> /dev/null
if [ $? -ne 0 ]; then
    echo "${red}Docker Compose is not installed. Please follow the install instructions for your system at https://docs.docker.com/compose/install/.${reset}"
    exit 2
fi

if [[ $quiet = 'false' ]]; then
    if [[ $verbose = 'false' ]]; then
        docker-compose up -d
    else
        docker-compose --verbose up -d
    fi
else
    docker-compose up -d &> /dev/null
fi

# Check errors
if [ $? -ne 0 ]; then
    echo "${red}It seems errors were encountered while spinning up the containers. ${reset}"
    exit 2
fi

# Remove .env file
#rm .env


# CHECK NODE INITIALIZATION
[[ $quiet = 'false' ]] && echo ""
[[ $quiet = 'false' ]] && printf "=> ${yellow}Waiting for API to fully initialize... "

while ! curl -sL localhost:${port} &> /dev/null; do sleep 1; done

[[ $quiet = 'false' ]] && printf "${green}Done! Open in your browser: http://localhost:${port}${reset}\n\n"
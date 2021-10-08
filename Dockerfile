FROM node:14
MAINTAINER Anarkrypto <anarkrypto@gmail.com>
LABEL Description="Open Source and Embedded Nano Faucet" \
	License="MIT License" \
	Version="1.0"

WORKDIR /usr/src/app

# Prepare environment
COPY ./package*.json ./
RUN npm install

EXPOSE 3000
EXPOSE 3001

RUN ls .

CMD [ "node", "src/init.js" ]
# NanoDrop
Open Source and Embedded Nano Faucet

Visit: https://nanodrop.io

![NanoDrop.io light](https://i.ibb.co/s1xCJ3x/nanodrop.png)

This project was created to help bring Nano to the masses.

Faucets are efficient ways to introduce cryptomoedas to new users. NanoDrop is not only another Nano faucet, but the first Nano Open Source Faucet, transparent and integrable through customizable Checkbox and API.

![Checkbox Light](https://i.ibb.co/CWKFCHS/output.gif)


NanoDrop includes:

- Faucet with customizable checkbox
- QR code reader
- 
- Automatic transaction receipt via websockets
- Real-time payment/receipt table with websockets
- Anti-spam and anti-bot barriers such as:
    - "Tickets" with amount, ip and timestamp signed using Nano's algorithm.
    - Google reCaptcha V2 - forces the user to solve the recaptcha challenge.
    - Google reCaptcha V3 - Gives the user a score to ensure they are not a bot.
    - Google oAuth - If the user's score is low, it requires login through a Google account.
    - Limit per Nano account
    - Limit by IP
    - Limit by email
- Public API for faucet data


### Flowchart Overview

<img src="https://i.ibb.co/YLn4yD1/diagrama.png" width="650px">


### Funding - Donate

<a href="https://funding.nanodrop.io">
  <img src="https://nanodrop.io/assets/donate.png" width="120px">
</a>

NanoDrop is a free, voluntary and open source initiative.
We don't use ads, we don't sell personal data.
Our focus is to bring Nano to the masses.

If you like it consider making a small donation, helping to distribute Nano to other users.

https://funding.nanodrop.io

## Setting up your instance:

You will need to give:

- An RPC address of a Nano node
- An websockets address of a Nano node
- A Nano worker-server, preferably fast. It can be the same with RPC, but it is recommended use GPU on it.
- Google Recaptcha V2 API Keys
- Google Recaptcha V3 API Keys
- Google oAuth API Keys
- A SEED for the Nano faucet account

Create the .env
```console
cp local.env .env
```

Now edit the ```.env``` file and put in the sensitive data (SEED, API keys). In the "index" it is recommended to leave 0

Edit the ```config/config.json``` file and put in the rpc, websockets and worker addresses. You can also edit the "representative" and the "minAmount" - minimum amount Nano (in raws) that can be received; by default 0.000001 Nano

### Running in dev mode:

```console
nodemon ./src/init.js
```

### Running in Prod with Docker

```console
chmod +x ./build-docker.sh
sudo ./build-docker.sh
```

This script will check if Docker is installed and then create the ```anarkrypto/nanodrop``` image and the ```nandrop``` container on your system.

If all goes well, you will receive this message:

```console
=> Waiting for API to fully initialize... Done! Open in your browser: http://localhost:3000
```

For recaptcha and oauth to work you will still need to configure your own DNS.

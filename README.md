# NanoDrop
Open Source, Transparent and Embedded Nano Faucet

Visit: https://nanodrop.io

![NanoDrop.io light](https://i.ibb.co/s1xCJ3x/nanodrop.png)

This project was created to help bring <a href="https://nano.org">Nano</a> to the masses.

Faucets are efficient ways to introduce cryptocurrency to new users.
Any amount is enough to show the benefits of Nano cryptocurrency: simple, instant, no fees.

NanoDrop is not only another Nano faucet, but the first Nano Open Source Faucet, transparent and integrable through customizable Checkbox and API.

![Checkbox Light](https://i.ibb.co/CWKFCHS/output.gif)


#### NanoDrop includes:

- Faucet with customizable checkbox.
- QR code reader.
- Nano deposits / donations automatically received.
- Real-time pay table with websockets.
- Anti-spam and anti-bot barriers such as:
    - "Tickets" with amount, ip and timestamp signed using Nano's algorithm
    - Google reCaptcha V2 - forces the user to solve the recaptcha challenge
    - Google reCaptcha V3 - Gives the user a score to ensure they are not a bot
    - Google oAuth - If the user's score is low, it requires login through a Google account
    - Limit per Nano account
    - Limit per IP address 
    - Limit per email address
- PoW cache, allowing for always instant transactions.
- Public API for faucet data.

#### Errors display

If the user exceeds the limits, sends some wrong information or we have an error on the server, the error will be displayed as follows

<img src="https://i.ibb.co/nR6hHkM/nanodrop-error-limit-reached-ip.png">

#### Calculation of each drop:

Returns 0.01% - 0.1% of the balance, rounded down.

Example: With a balance of 1.145 Nano, returns 0.001 instead 0.00145

Or returns the maximum configured amount, by default = 0.01 Nano.

If there is not enough balance, an error is displayed.

<img src="https://i.ibb.co/VMnhZbL/nanodrop-no-funds-error.png">

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
- A Nano worker-server, preferably fast. It can be the same as RPC, but it is recommended use GPU on it.
- Google reCaptcha V2 API Keys
- Google reCaptcha V3 API Keys
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

This script will check if Docker is installed and then create the ```anarkrypto/nanodrop``` image and the ```nanodrop``` container on your system.

If all goes well, you will receive this message:

```console
=> Waiting for API to fully initialize... Done! Open in your browser: http://localhost:3000
```

For Google reCaptcha and Google oAuth to work you will need to configure your own DNS.

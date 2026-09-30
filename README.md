# ChainPocket

ChainPocket is a dependency-free, mobile-first EVM DApp designed for static hosting on Render.

## Features

- Connects to injected EVM wallets
- Reads native token balance
- Switches between supported EVM networks
- Signs a UTF-8 message with `personal_sign`
- Sends native token transfers after an in-app confirmation
- Includes a MetaMask mobile deep link and installable PWA shell

## Local preview

Run any static file server from this directory. For example:

```powershell
npx serve .
```

Wallet features require HTTPS or a wallet browser in production.

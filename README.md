# Homebridge Sensus

[![npm version](https://img.shields.io/npm/v/homebridge-sensus.svg)](https://www.npmjs.com/package/homebridge-sensus)
[![npm downloads](https://img.shields.io/npm/dt/homebridge-sensus.svg)](https://www.npmjs.com/package/homebridge-sensus)
[![license](https://img.shields.io/npm/l/homebridge-sensus.svg)](LICENSE)

A [Homebridge](https://homebridge.io) plugin that brings your **Sensus Analytics**
water meter into Apple HomeKit. It polls your utility's Sensus Analytics portal,
exposes a **leak sensor** in the Apple Home app, and publishes daily and cumulative
water-consumption graphs to the [Eve for HomeKit](https://www.evehome.com/en/eve-app)
app.

> ⚠️ **Unofficial.** This project is not affiliated with, endorsed by, or supported
> by Sensus, Xylem, or your water utility. It works by logging into the same web
> portal you use and reading your own meter data.

## Features

- 💧 **Leak sensor in HomeKit** — triggers an alert when daily usage exceeds a
  configurable threshold, so you can get a push notification or run an automation.
- 📊 **Eve consumption graphs** — daily usage and a running total (odometer) are
  exposed as Eve custom characteristics for historical graphing.
- 🔄 **Automatic unit conversion** — raw meter readings (CCF, cubic feet, liters)
  are normalized to gallons internally, with an option to display in gallons or liters.
- ⏱️ **Configurable polling** — choose how often to fetch fresh readings.
- 🔁 **Session recovery** — re-authenticates automatically when the portal session expires.

## Requirements

- [Homebridge](https://homebridge.io) v1.6.0 or newer (Homebridge 2.x supported)
- Node.js v18 or newer
- A water utility account on a **Sensus Analytics** portal
  (e.g. `https://yourcity.sensus-analytics.com`)

## Installation

The easiest way to install and configure this plugin is through the
[Homebridge UI](https://github.com/homebridge/homebridge-config-ui-x): search for
**`homebridge-sensus`** on the Plugins tab and click **Install**.

To install from the command line:

```bash
npm install -g homebridge-sensus
```

## Configuration

Add a platform block to your Homebridge `config.json`, or use the form provided by
the Homebridge UI. The platform identifier is **`SensusAnalytics`**.

```json
{
  "platforms": [
    {
      "platform": "SensusAnalytics",
      "name": "Sensus Water Meter",
      "baseUrl": "https://yourcity.sensus-analytics.com",
      "username": "you@example.com",
      "password": "your-portal-password",
      "accountNumber": "123456789",
      "meterNumber": "987654321",
      "leakThreshold": 150,
      "pollInterval": 30,
      "displayUnit": "gal",
      "sensusDisplayMultiplier": 1
    }
  ]
}
```

### Options

| Field | Required | Default | Description |
| --- | --- | --- | --- |
| `name` | ✅ | `Sensus Water Meter` | Accessory name shown in the Home app. |
| `baseUrl` | ✅ | — | Base URL of your Sensus Analytics portal, with **no** trailing slash. |
| `username` | ✅ | — | Your Sensus Analytics login username. |
| `password` | ✅ | — | Your Sensus Analytics login password. |
| `accountNumber` | ✅ | — | Your utility account number. |
| `meterNumber` | ✅ | — | Your meter / device number. |
| `leakThreshold` | | `150` | Daily usage **in gallons** above which the HomeKit leak sensor trips. |
| `pollInterval` | | `30` | How often to fetch new data, in minutes. |
| `displayUnit` | | `gal` | Unit shown in HomeKit / Eve: `gal` (gallons) or `l` (liters). |
| `sensusDisplayMultiplier` | | `1` | Multiplier applied after the gallons conversion. See below. |

> 🔐 Your portal credentials are stored in your Homebridge `config.json` and are sent
> only to the `baseUrl` you configure. Treat your `config.json` as sensitive.

### About the Sensus Display Multiplier

The plugin converts raw meter readings to gallons automatically based on the unit the
portal reports (CCF, CF, liters). If the values shown on the Sensus website are a
consistent multiple of what HomeKit displays — for example the portal reads **10×**
the HomeKit value — set `sensusDisplayMultiplier` to that factor (e.g. `10`) to line
them up. Leave it at `1` if your readings already match.

## How it appears

- **Apple Home app** — a leak sensor tile. It shows *Leak Detected* whenever the
  most recent daily usage exceeds `leakThreshold`. Use it in automations or to receive
  notifications.
- **Eve for HomeKit app** — the same accessory exposes *Water Consumption* (daily) and
  *Total Water Consumption* (cumulative odometer) characteristics, which Eve renders as
  historical graphs.

## Troubleshooting

- **No data / login failures** — double-check `baseUrl` (no trailing slash), username,
  and password by logging into the portal in a browser. Run Homebridge in debug mode
  (`homebridge -D`) to see detailed request logs.
- **Numbers look off by a constant factor** — set `sensusDisplayMultiplier` (see above).
- **Accessory not appearing** — confirm the platform name is exactly `SensusAnalytics`
  and restart Homebridge.

## Development

```bash
git clone https://github.com/jmarrmd/Homebridge-Sensus.git
cd Homebridge-Sensus
npm install
npm run build   # compile TypeScript to dist/
npm run watch   # recompile on change
```

## License

[MIT](LICENSE) © Josh Marr

# MongoDB Local Installation Guide

This guide helps you install and run MongoDB locally in a WSL environment without requiring sudo privileges.

## Installation

1. Run the installation script:
   ```bash
   bash mongo-install.sh
   ```

   This script will:
   - Download MongoDB 7.0.5 for Ubuntu 22.04
   - Extract it to `~/mongodb/`
   - Create data, logs, and config directories
   - Create symbolic links in `~/bin/`
   - Set up basic configuration

2. Source your `.bashrc` to update PATH:
   ```bash
   source ~/.bashrc
   ```

## Starting and Stopping MongoDB

Use the provided scripts:

- Start MongoDB:
  ```bash
  bash start-mongodb.sh
  ```

- Stop MongoDB:
  ```bash
  bash stop-mongodb.sh
  ```

## Connecting to MongoDB

### Using the MongoDB Shell

```bash
~/mongodb/mongodb-linux-x86_64-ubuntu2204-7.0.5/bin/mongosh
```

Or if you have the symbolic links set up:

```bash
mongosh
```

### Using Node.js

A sample Node.js client script is provided in `mongodb-client.js`. To use it:

1. Install the MongoDB Node.js driver:
   ```bash
   npm install mongodb
   ```

2. Run the client script:
   ```bash
   node mongodb-client.js
   ```

## MongoDB Configuration

The configuration file is located at:
```
~/mongodb/config/mongod.conf
```

Key settings:
- Port: 27017
- Bind IP: 127.0.0.1 (localhost only)
- Data directory: ~/mongodb/data
- Log file: ~/mongodb/logs/mongod.log

## Data Location

All MongoDB data is stored in:
```
~/mongodb/data
```

To reset your database, you can stop MongoDB and delete this directory.

## Troubleshooting

1. If MongoDB fails to start, check the logs:
   ```bash
   cat ~/mongodb/logs/mongod.log
   ```

2. Verify MongoDB is running:
   ```bash
   pgrep -f mongod
   ```

3. Check if you can connect to MongoDB:
   ```bash
   mongosh --eval "db.serverStatus()"
   ```

4. If you receive a "command not found" error, ensure your PATH includes `~/bin`
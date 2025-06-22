#!/bin/bash

# Check if MongoDB is running
check_mongodb_running() {
  pgrep -f mongod >/dev/null
  return $?
}

# Directory paths
MONGO_HOME="$HOME/mongodb"
MONGO_BIN_DIR="$MONGO_HOME/mongodb-linux-x86_64-ubuntu2204-7.0.5/bin"
MONGO_DATA_DIR="$MONGO_HOME/data"
MONGO_LOG_DIR="$MONGO_HOME/logs"
MONGO_CONFIG_DIR="$MONGO_HOME/config"

# First check if MongoDB is already running
if check_mongodb_running; then
  echo "MongoDB is already running"
  exit 0
fi

# Make sure binary exists
if [ ! -f "$MONGO_BIN_DIR/mongod" ]; then
  echo "MongoDB binaries not found. Please run mongo-install.sh first."
  exit 1
fi

# Ensure directories exist
mkdir -p "$MONGO_DATA_DIR" "$MONGO_LOG_DIR"

# Start MongoDB
echo "Starting MongoDB server..."
"$MONGO_BIN_DIR/mongod" --dbpath "$MONGO_DATA_DIR" --logpath "$MONGO_LOG_DIR/mongod.log" --fork

# Check if MongoDB started successfully
if check_mongodb_running; then
  echo "MongoDB started successfully. Data directory: $MONGO_DATA_DIR, Log file: $MONGO_LOG_DIR/mongod.log"
  echo "To connect: $MONGO_BIN_DIR/mongosh"
else
  echo "Failed to start MongoDB. Check logs at $MONGO_LOG_DIR/mongod.log"
  exit 1
fi
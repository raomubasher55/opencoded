#!/bin/bash

# Check if MongoDB is running
check_mongodb_running() {
  pgrep -f mongod >/dev/null
  return $?
}

# Directory paths
MONGO_HOME="$HOME/mongodb"
MONGO_BIN_DIR="$MONGO_HOME/mongodb-linux-x86_64-ubuntu2204-7.0.5/bin"

# Check if MongoDB is running
if ! check_mongodb_running; then
  echo "MongoDB is not running"
  exit 0
fi

# Stop MongoDB
echo "Stopping MongoDB server..."
"$MONGO_BIN_DIR/mongod" --shutdown

# Verify MongoDB stopped
sleep 2
if check_mongodb_running; then
  echo "Failed to stop MongoDB. You may need to manually kill the process."
  exit 1
else
  echo "MongoDB stopped successfully"
fi
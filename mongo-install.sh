#!/bin/bash
set -e

# MongoDB local installation script (without sudo)
MONGO_VERSION="7.0.5"
MONGO_DOWNLOAD_URL="https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-ubuntu2204-${MONGO_VERSION}.tgz"
MONGO_EXTRACT_DIR="$HOME/mongodb"
MONGO_DATA_DIR="$HOME/mongodb/data"
MONGO_LOG_DIR="$HOME/mongodb/logs"
MONGO_CONFIG_DIR="$HOME/mongodb/config"

echo "Installing MongoDB ${MONGO_VERSION} locally in $MONGO_EXTRACT_DIR"

# Create directories
mkdir -p "$MONGO_EXTRACT_DIR" "$MONGO_DATA_DIR" "$MONGO_LOG_DIR" "$MONGO_CONFIG_DIR"
echo "Created MongoDB directories"

# Download MongoDB if not already downloaded
if [ ! -f "$MONGO_EXTRACT_DIR/mongodb-linux-x86_64-ubuntu2204-${MONGO_VERSION}.tgz" ]; then
  echo "Downloading MongoDB ${MONGO_VERSION}..."
  curl -o "$MONGO_EXTRACT_DIR/mongodb-linux-x86_64-ubuntu2204-${MONGO_VERSION}.tgz" "$MONGO_DOWNLOAD_URL"
else
  echo "MongoDB archive already downloaded, skipping download"
fi

# Extract MongoDB if not already extracted
if [ ! -d "$MONGO_EXTRACT_DIR/mongodb-linux-x86_64-ubuntu2204-${MONGO_VERSION}" ]; then
  echo "Extracting MongoDB..."
  tar -zxvf "$MONGO_EXTRACT_DIR/mongodb-linux-x86_64-ubuntu2204-${MONGO_VERSION}.tgz" -C "$MONGO_EXTRACT_DIR"
else
  echo "MongoDB already extracted, skipping extraction"
fi

# Create symbolic links to binaries
mkdir -p "$HOME/bin"
for FILE in "$MONGO_EXTRACT_DIR/mongodb-linux-x86_64-ubuntu2204-${MONGO_VERSION}/bin/"*; do
  ln -sf "$FILE" "$HOME/bin/$(basename "$FILE")" 2>/dev/null || true
done
echo "Created symbolic links to MongoDB binaries in $HOME/bin"

# Create mongod configuration file
cat > "$MONGO_CONFIG_DIR/mongod.conf" << EOL
# mongod.conf

# Where and how to store data
storage:
  dbPath: ${MONGO_DATA_DIR}
  journal:
    enabled: true

# Where to write logging data
systemLog:
  destination: file
  logAppend: true
  path: ${MONGO_LOG_DIR}/mongod.log

# Network interfaces
net:
  port: 27017
  bindIp: 127.0.0.1

# Process management options
processManagement:
   fork: true
EOL
echo "Created MongoDB configuration file"

# Create convenience scripts
cat > "$HOME/bin/start-mongodb" << EOL
#!/bin/bash
$HOME/bin/mongod --config $MONGO_CONFIG_DIR/mongod.conf
echo "MongoDB started with config from $MONGO_CONFIG_DIR/mongod.conf"
EOL

cat > "$HOME/bin/stop-mongodb" << EOL
#!/bin/bash
$HOME/bin/mongod --config $MONGO_CONFIG_DIR/mongod.conf --shutdown
echo "MongoDB stopped"
EOL

chmod +x "$HOME/bin/start-mongodb" "$HOME/bin/stop-mongodb"
echo "Created start and stop scripts"

# Update PATH if needed
if [[ ":$PATH:" != *":$HOME/bin:"* ]]; then
  echo 'export PATH="$HOME/bin:$PATH"' >> "$HOME/.bashrc"
  echo "Added $HOME/bin to PATH in .bashrc"
fi

echo "MongoDB ${MONGO_VERSION} installation completed"
echo ""
echo "To start MongoDB: $HOME/bin/start-mongodb"
echo "To stop MongoDB: $HOME/bin/stop-mongodb"
echo "To use MongoDB shell: $HOME/bin/mongosh"
echo ""
echo "You may need to run 'source ~/.bashrc' or restart your terminal to update your PATH"
// MongoDB Node.js client script
// This script demonstrates how to connect to your local MongoDB instance

const { MongoClient } = require('mongodb');

// Connection URL
const url = 'mongodb://localhost:27017';
const client = new MongoClient(url);

// Database Name
const dbName = 'opencode_db';

async function main() {
  // Use connect method to connect to the server
  await client.connect();
  console.log('Connected successfully to MongoDB server');
  
  const db = client.db(dbName);
  
  // Create a test collection
  const collection = db.collection('test');
  
  // Insert a test document
  const insertResult = await collection.insertOne({
    name: 'Test Document',
    createdAt: new Date(),
    testValue: 42
  });
  console.log('Inserted document:', insertResult);
  
  // Find the document we just inserted
  const findResult = await collection.findOne({});
  console.log('Found document:', findResult);
  
  return 'MongoDB connection test completed successfully';
}

main()
  .then(console.log)
  .catch(console.error)
  .finally(() => client.close());
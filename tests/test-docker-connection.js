#!/usr/bin/env node

// Simple test script to verify Docker connection detection
const utils = require('./lib/utils');

console.log('Testing Docker connection detection...\n');

// Test findDockerPath
const dockerPath = utils.findDockerPath();
console.log('Docker executable path:', dockerPath);

// Test findDockerSocketPath
const socketPath = utils.findDockerSocketPath();
console.log('Docker socket path:', socketPath);

// Test getDockerConnectionOptions
const connectionOptions = utils.getDockerConnectionOptions();
console.log('Docker connection options:', JSON.stringify(connectionOptions, null, 2));

// Test actual Docker connection
try {
  const Docker = require('dockerode');
  const docker = new Docker(connectionOptions);
  
  console.log('\nTesting Docker connection...');
  docker.listImages((err, images) => {
    if (err) {
      console.error('Failed to connect to Docker:', err.message);
    } else {
      console.log(`Successfully connected to Docker! Found ${images.length} images.`);
    }
  });
} catch (error) {
  console.error('Error creating Docker connection:', error.message);
}
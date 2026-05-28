#!/usr/bin/env node

// Test script for db health endpoint
// This can be run with: node test-db-health.js

import http from 'http';

const options = {
  hostname: 'localhost',
  port: 4003,
  path: '/api/db/health',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  },
};

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log('Response:', data);
  });
});

req.on('error', (error) => {
  console.error('Error:', error.message);
});

req.end();
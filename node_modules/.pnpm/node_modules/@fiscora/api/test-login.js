#!/usr/bin/env node

// Test script for login endpoint
// This can be run with: node test-login.js

import http from "http";

const testData = {
  email: "test@example.com",
  password: "test-password-123456",
};

const options = {
  hostname: "localhost",
  port: 4005,
  path: "/api/auth/login",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
};

const req = http.request(options, (res) => {
  let data = "";

  res.on("data", (chunk) => {
    data += chunk;
  });

  res.on("end", () => {
    console.log(`Status: ${res.statusCode}`);
    console.log("Response:", data);

    if (res.statusCode === 200) {
      const response = JSON.parse(data);
      console.log("✅ Login successful!");
      console.log("Access token:", response.accessToken.substring(0, 50) + "...");
      console.log("User:", response.user);
    } else if (res.statusCode === 401) {
      console.log("❌ Login failed - 401 Unauthorized");
    } else {
      console.log("❌ Unexpected response");
    }
  });
});

req.on("error", (error) => {
  console.error("Error:", error.message);
});

// Write data to request body
req.write(JSON.stringify(testData));
req.end();

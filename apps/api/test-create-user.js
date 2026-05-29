#!/usr/bin/env node

// Test script to create a test user
// This can be run with: node test-create-user.js

import { PrismaClient } from "@prisma/client";
import { hash } from "argon2";

const prisma = new PrismaClient();

async function createTestUser() {
  try {
    const email = "test@example.com";
    const password = "test-password-123456";

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      console.log("User already exists:", email);
      return;
    }

    // Hash password
    const passwordHash = await hash(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: "Test User",
        role: "SUPER_ADMIN",
      },
    });

    console.log("User created successfully:", user);
    console.log("Email:", email);
    console.log("Password:", password);
  } catch (error) {
    console.error("Error creating user:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();

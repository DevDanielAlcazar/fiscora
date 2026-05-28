#!/usr/bin/env node

// Test script to check user exists
// This can be run with: node test-check-user.js

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUser() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'test@example.com' }
    });
    
    console.log('User found:', user);
    if (user) {
      console.log('User ID:', user.id);
      console.log('User email:', user.email);
      console.log('User role:', user.role);
      console.log('Password hash exists:', !!user.passwordHash);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    // Validate input
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingIdentity = await prisma.userIdentity.findUnique({
      where: {
        unique_provider_user: {
          provider: 'PASSWORD',
          providerUserId: username,
        },
      },
    });

    if (existingIdentity) {
      return NextResponse.json(
        { error: 'Username already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user with PASSWORD identity
    const newUser = await prisma.user.create({
      data: {
        name: username,
        identities: {
          create: {
            provider: 'PASSWORD',
            providerUserId: username,
            metadata: {
              passwordHash,
            },
            isPrimary: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        userId: newUser.id,
        username: newUser.name
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}
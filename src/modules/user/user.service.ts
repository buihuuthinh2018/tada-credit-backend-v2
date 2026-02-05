import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { user_status } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private generateReferralCode(): string {
    return uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
  }

  async create(dto: CreateUserDto) {
    // Check if email or phone already exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.email },
          { phone: dto.phone },
        ],
      },
    });

    if (existingUser) {
      if (existingUser.email === dto.email) {
        throw new ConflictException('Email already in use');
      }
      throw new ConflictException('Phone number already in use');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Generate unique referral code
    let referralCode = this.generateReferralCode();
    while (await this.prisma.user.findUnique({ where: { referral_code: referralCode } })) {
      referralCode = this.generateReferralCode();
    }

    // Check if referrer exists
    let referrerId: string | undefined;
    if (dto.referralCode) {
      const referrer = await this.prisma.user.findUnique({
        where: { referral_code: dto.referralCode },
      });
      if (!referrer) {
        throw new NotFoundException('Invalid referral code');
      }
      referrerId = referrer.id;
    }

    // Determine initial status based on OTP configuration
    const otpRequired = this.configService.get<string>('OTP_REQUIRED') === 'true';
    const initialStatus: user_status = otpRequired ? 'PENDING_VERIFY' : 'ACTIVE';

    // Get default USER role
    const userRole = await this.prisma.role.findUnique({
      where: { code: 'USER' },
    });

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        phone: dto.phone,
        password: hashedPassword,
        fullname: dto.fullname,
        gender: dto.gender,
        birth_date: new Date(dto.birthDate),
        referral_code: referralCode,
        referred_by: referrerId,
        status: initialStatus,
        roles: userRole ? {
          create: {
            role_id: userRole.id,
          },
        } : undefined,
        wallet: {
          create: {},
        },
      },
      select: {
        id: true,
        email: true,
        phone: true,
        fullname: true,
        gender: true,
        birth_date: true,
        referral_code: true,
        status: true,
        created_at: true,
      },
    });

    return user;
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        phone: true,
        fullname: true,
        gender: true,
        birth_date: true,
        referral_code: true,
        status: true,
        created_at: true,
        roles: {
          select: {
            role: {
              select: {
                id: true,
                code: true,
                name: true,
                permissions: {
                  select: {
                    permission: {
                      select: {
                        code: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Collect all unique permissions from roles
    const allPermissions = new Set<string>();
    user.roles.forEach((r) => {
      r.role.permissions.forEach((p) => {
        allPermissions.add(p.permission.code);
      });
    });

    return {
      ...user,
      roles: user.roles.map((r) => r.role),
      permissions: Array.from(allPermissions),
    };
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async findAll(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;

    // Build where clause for search
    const where = search ? {
      OR: [
        { id: { contains: search } },
        { fullname: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ],
    } : {};

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          email: true,
          phone: true,
          fullname: true,
          gender: true,
          birth_date: true,
          referral_code: true,
          status: true,
          created_at: true,
          roles: {
            select: {
              role: {
                select: {
                  code: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: data.map((user) => ({
        ...user,
        roles: user.roles.map((r) => r.role),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  // Search users for CTV (limited fields for privacy)
  async searchUsers(query: string, limit = 10) {
    const data = await this.prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: query } },
          { phone: { contains: query } },
          { fullname: { contains: query } },
        ],
      },
      take: limit,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        email: true,
        phone: true,
        fullname: true,
        status: true,
      },
    });

    return {
      data,
      meta: {
        total: data.length,
        page: 1,
        limit,
        totalPages: 1,
      },
    };
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check phone uniqueness if updating
    if (dto.phone && dto.phone !== user.phone) {
      const existingPhone = await this.prisma.user.findUnique({
        where: { phone: dto.phone },
      });
      if (existingPhone) {
        throw new ConflictException('Phone number already in use');
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        phone: dto.phone,
        fullname: dto.fullname,
        gender: dto.gender,
        birth_date: dto.birthDate ? new Date(dto.birthDate) : undefined,
        status: dto.status,
      },
      select: {
        id: true,
        email: true,
        phone: true,
        fullname: true,
        gender: true,
        birth_date: true,
        referral_code: true,
        status: true,
        created_at: true,
      },
    });
  }

  async assignRole(userId: string, roleId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Check if already assigned
    const existing = await this.prisma.user_role.findFirst({
      where: { user_id: userId, role_id: roleId },
    });
    if (existing) {
      throw new ConflictException('Role already assigned to user');
    }

    return this.prisma.user_role.create({
      data: {
        user_id: userId,
        role_id: roleId,
      },
      include: {
        role: {
          select: {
            code: true,
            name: true,
          },
        },
      },
    });
  }

  async removeRole(userId: string, roleId: string) {
    const userRole = await this.prisma.user_role.findFirst({
      where: { user_id: userId, role_id: roleId },
    });
    if (!userRole) {
      throw new NotFoundException('User does not have this role');
    }

    await this.prisma.user_role.delete({
      where: { id: userRole.id },
    });

    return { message: 'Role removed successfully' };
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      return [];
    }

    const permissions = new Set<string>();
    for (const userRole of user.roles) {
      for (const rolePermission of userRole.role.permissions) {
        permissions.add(rolePermission.permission.code);
      }
    }

    return Array.from(permissions);
  }

  async getUserRoles(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      return [];
    }

    return user.roles.map((ur) => ur.role.code);
  }

  async getReferrals(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { referred_by: userId },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          email: true,
          fullname: true,
          created_at: true,
          status: true,
        },
      }),
      this.prisma.user.count({ where: { referred_by: userId } }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async verifyUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.status !== 'PENDING_VERIFY') {
      throw new ConflictException('User is not pending verification');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { status: 'ACTIVE' },
      select: {
        id: true,
        email: true,
        status: true,
      },
    });
  }

  async suspendUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { status: 'SUSPENDED' },
      select: {
        id: true,
        email: true,
        status: true,
      },
    });
  }

  async activateUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { status: 'ACTIVE' },
      select: {
        id: true,
        email: true,
        status: true,
      },
    });
  }
}

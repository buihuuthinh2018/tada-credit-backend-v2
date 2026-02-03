import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto, UpdateRoleDto } from './dto';

@Injectable()
export class RoleService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new ConflictException('Role code already exists');
    }

    return this.prisma.role.create({
      data: {
        code: dto.code.toUpperCase(),
        name: dto.name,
        description: dto.description,
        is_system: dto.isSystem ?? false,
      },
    });
  }

  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.role.findMany({
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          _count: {
            select: { users: true, permissions: true },
          },
        },
      }),
      this.prisma.role.count(),
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

  async findById(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: { users: true },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return {
      ...role,
      permissions: role.permissions.map((rp) => rp.permission),
    };
  }

  async findByCode(code: string) {
    const role = await this.prisma.role.findUnique({
      where: { code },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return {
      ...role,
      permissions: role.permissions.map((rp) => rp.permission),
    };
  }

  async update(id: string, dto: UpdateRoleDto) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (role.is_system) {
      throw new BadRequestException('Cannot modify system role');
    }

    return this.prisma.role.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
      },
    });
  }

  async delete(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (role.is_system) {
      throw new BadRequestException('Cannot delete system role');
    }

    if (role._count.users > 0) {
      throw new BadRequestException('Cannot delete role with assigned users');
    }

    // Delete role permissions first
    await this.prisma.role_permission.deleteMany({
      where: { role_id: id },
    });

    return this.prisma.role.delete({ where: { id } });
  }

  async assignPermission(roleId: string, permissionId: string) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const permission = await this.prisma.permission.findUnique({ where: { id: permissionId } });
    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    const existing = await this.prisma.role_permission.findFirst({
      where: { role_id: roleId, permission_id: permissionId },
    });

    if (existing) {
      throw new ConflictException('Permission already assigned to role');
    }

    return this.prisma.role_permission.create({
      data: {
        role_id: roleId,
        permission_id: permissionId,
      },
      include: {
        permission: true,
      },
    });
  }

  async removePermission(roleId: string, permissionId: string) {
    const rolePermission = await this.prisma.role_permission.findFirst({
      where: { role_id: roleId, permission_id: permissionId },
    });

    if (!rolePermission) {
      throw new NotFoundException('Permission not assigned to this role');
    }

    await this.prisma.role_permission.delete({
      where: { id: rolePermission.id },
    });

    return { message: 'Permission removed from role' };
  }

  async getRolePermissions(roleId: string) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return role.permissions.map((rp) => rp.permission);
  }
}

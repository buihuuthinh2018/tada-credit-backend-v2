import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Create permissions
  const permissions = [
    // User permissions
    { code: 'user:read', name: 'Read Users' },
    { code: 'user:update', name: 'Update Users' },
    { code: 'user:delete', name: 'Delete Users' },
    { code: 'user:manage-roles', name: 'Manage User Roles' },
    { code: 'user:verify', name: 'Verify Users' },
    { code: 'user:suspend', name: 'Suspend Users' },
    { code: 'user:activate', name: 'Activate Users' },
    
    // Role permissions
    { code: 'role:create', name: 'Create Roles' },
    { code: 'role:read', name: 'Read Roles' },
    { code: 'role:update', name: 'Update Roles' },
    { code: 'role:delete', name: 'Delete Roles' },
    { code: 'role:manage-permissions', name: 'Manage Role Permissions' },
    
    // Permission permissions
    { code: 'permission:create', name: 'Create Permissions' },
    { code: 'permission:read', name: 'Read Permissions' },
    { code: 'permission:update', name: 'Update Permissions' },
    { code: 'permission:delete', name: 'Delete Permissions' },
    
    // Service permissions
    { code: 'service:create', name: 'Create Services' },
    { code: 'service:read', name: 'Read Services' },
    { code: 'service:update', name: 'Update Services' },
    { code: 'service:delete', name: 'Delete Services' },
    
    // Workflow permissions
    { code: 'workflow:create', name: 'Create Workflows' },
    { code: 'workflow:read', name: 'Read Workflows' },
    { code: 'workflow:update', name: 'Update Workflows' },
    
    // Contract permissions
    { code: 'contract:read', name: 'Read Contracts' },
    { code: 'contract:transition', name: 'Transition Contracts' },
    
    // Document permissions
    { code: 'document:create', name: 'Create Document Requirements' },
    { code: 'document:read', name: 'Read Documents' },
    { code: 'document:update', name: 'Update Documents' },
    { code: 'document:delete', name: 'Delete Documents' },
    { code: 'document:review', name: 'Review Documents' },
    
    // Question permissions
    { code: 'question:create', name: 'Create Questions' },
    { code: 'question:read', name: 'Read Questions' },
    { code: 'question:update', name: 'Update Questions' },
    { code: 'question:delete', name: 'Delete Questions' },
    
    // Commission permissions
    { code: 'commission:create', name: 'Create Commission Config' },
    { code: 'commission:read', name: 'Read Commission Config' },
    { code: 'commission:update', name: 'Update Commission Config' },
    
    // Wallet permissions
    { code: 'wallet:read', name: 'Read Wallets' },
    { code: 'wallet:verify', name: 'Verify Wallet Integrity' },
    
    // Withdrawal permissions
    { code: 'withdrawal:read', name: 'Read Withdrawals' },
    { code: 'withdrawal:process', name: 'Process Withdrawals' },
    
    // Audit permissions
    { code: 'audit:read', name: 'Read Audit Logs' },

    // Workflow transition permissions (dynamic)
    { code: 'workflow:transition:review', name: 'Transition to Review Stage' },
    { code: 'workflow:transition:approve', name: 'Transition to Approved Stage' },
    { code: 'workflow:transition:reject', name: 'Transition to Rejected Stage' },
    { code: 'workflow:transition:complete', name: 'Transition to Complete Stage' },
  ];

  console.log('Creating permissions...');
  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: {},
      create: perm,
    });
  }

  // Create roles
  const roles = [
    { code: 'ADMIN', name: 'Administrator', description: 'Full system access', is_system: true },
    { code: 'USER', name: 'User', description: 'Regular user', is_system: true },
    { code: 'CTV', name: 'Collaborator', description: 'Sales collaborator with commission', is_system: true },
    { code: 'SUPPORT', name: 'Support', description: 'Customer support', is_system: true },
    { code: 'MANAGER', name: 'Manager', description: 'Department manager', is_system: true },
  ];

  console.log('Creating roles...');
  const createdRoles: Record<string, { id: string }> = {};
  for (const role of roles) {
    const created = await prisma.role.upsert({
      where: { code: role.code },
      update: {},
      create: role,
    });
    createdRoles[role.code] = created;
  }

  // Assign all permissions to ADMIN role
  console.log('Assigning permissions to ADMIN role...');
  const allPermissions = await prisma.permission.findMany();
  for (const perm of allPermissions) {
    await prisma.role_permission.upsert({
      where: {
        role_id_permission_id: {
          role_id: createdRoles['ADMIN'].id,
          permission_id: perm.id,
        },
      },
      update: {},
      create: {
        role_id: createdRoles['ADMIN'].id,
        permission_id: perm.id,
      },
    });
  }

  // Assign specific permissions to SUPPORT role
  console.log('Assigning permissions to SUPPORT role...');
  const supportPermissions = ['user:read', 'contract:read', 'document:read', 'document:review', 'withdrawal:read'];
  for (const permCode of supportPermissions) {
    const perm = allPermissions.find(p => p.code === permCode);
    if (perm) {
      await prisma.role_permission.upsert({
        where: {
          role_id_permission_id: {
            role_id: createdRoles['SUPPORT'].id,
            permission_id: perm.id,
          },
        },
        update: {},
        create: {
          role_id: createdRoles['SUPPORT'].id,
          permission_id: perm.id,
        },
      });
    }
  }

  // Assign specific permissions to MANAGER role
  console.log('Assigning permissions to MANAGER role...');
  const managerPermissions = [
    'user:read', 'user:update', 'user:verify',
    'contract:read', 'contract:transition',
    'document:read', 'document:review',
    'withdrawal:read', 'withdrawal:process',
    'workflow:transition:review', 'workflow:transition:approve', 'workflow:transition:reject', 'workflow:transition:complete',
  ];
  for (const permCode of managerPermissions) {
    const perm = allPermissions.find(p => p.code === permCode);
    if (perm) {
      await prisma.role_permission.upsert({
        where: {
          role_id_permission_id: {
            role_id: createdRoles['MANAGER'].id,
            permission_id: perm.id,
          },
        },
        update: {},
        create: {
          role_id: createdRoles['MANAGER'].id,
          permission_id: perm.id,
        },
      });
    }
  }

  // Create default workflow
  console.log('Creating default workflow...');
  const workflow = await prisma.workflow.upsert({
    where: { id: 'default-workflow-v1' },
    update: {},
    create: {
      id: 'default-workflow-v1',
      name: 'Default Credit Workflow',
      version: 1,
      is_active: true,
    },
  });

  // Create workflow stages
  const stages = [
    { code: 'DRAFT', name: 'Draft', stage_order: 0 },
    { code: 'SUBMITTED', name: 'Submitted', stage_order: 1 },
    { code: 'UNDER_REVIEW', name: 'Under Review', stage_order: 2 },
    { code: 'APPROVED', name: 'Approved', stage_order: 3 },
    { code: 'REJECTED', name: 'Rejected', stage_order: 4 },
    { code: 'COMPLETED', name: 'Completed', stage_order: 5 },
  ];

  console.log('Creating workflow stages...');
  const createdStages: Record<string, { id: string }> = {};
  for (const stage of stages) {
    const existing = await prisma.workflow_stage.findFirst({
      where: { workflow_id: workflow.id, code: stage.code },
    });
    
    if (existing) {
      createdStages[stage.code] = existing;
    } else {
      const created = await prisma.workflow_stage.create({
        data: {
          workflow_id: workflow.id,
          ...stage,
        },
      });
      createdStages[stage.code] = created;
    }
  }

  // Create workflow transitions
  const transitions = [
    { from: 'DRAFT', to: 'SUBMITTED', permission: null },
    { from: 'SUBMITTED', to: 'UNDER_REVIEW', permission: 'workflow:transition:review' },
    { from: 'UNDER_REVIEW', to: 'APPROVED', permission: 'workflow:transition:approve' },
    { from: 'UNDER_REVIEW', to: 'REJECTED', permission: 'workflow:transition:reject' },
    { from: 'APPROVED', to: 'COMPLETED', permission: 'workflow:transition:complete' },
  ];

  console.log('Creating workflow transitions...');
  for (const trans of transitions) {
    const existing = await prisma.workflow_transition.findFirst({
      where: {
        workflow_id: workflow.id,
        from_stage_id: createdStages[trans.from].id,
        to_stage_id: createdStages[trans.to].id,
      },
    });
    
    if (!existing) {
      await prisma.workflow_transition.create({
        data: {
          workflow_id: workflow.id,
          from_stage_id: createdStages[trans.from].id,
          to_stage_id: createdStages[trans.to].id,
          required_permission: trans.permission,
        },
      });
    }
  }

  // Create document requirements
  console.log('Creating document requirements...');
  const docRequirements = [
    {
      code: 'ID_CARD',
      name: 'Identity Card',
      config: {
        minFiles: 1,
        maxFiles: 2,
        allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
        maxSizeBytes: 5 * 1024 * 1024, // 5MB
      },
    },
    {
      code: 'INCOME_PROOF',
      name: 'Income Proof',
      config: {
        minFiles: 1,
        maxFiles: 3,
        allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
        maxSizeBytes: 10 * 1024 * 1024, // 10MB
      },
    },
    {
      code: 'ADDRESS_PROOF',
      name: 'Address Proof',
      config: {
        minFiles: 1,
        maxFiles: 2,
        allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
        maxSizeBytes: 5 * 1024 * 1024,
      },
    },
  ];

  for (const doc of docRequirements) {
    await prisma.document_requirement.upsert({
      where: { code: doc.code },
      update: {},
      create: {
        ...doc,
        version: 1,
      },
    });
  }

  // Create commission configs
  console.log('Creating commission configs...');
  const commissionConfigs = [
    { role_code: 'USER', rate: 0.05 }, // 5% for regular users
    { role_code: 'CTV', rate: 0.10 }, // 10% for collaborators
  ];

  for (const config of commissionConfigs) {
    const existing = await prisma.commission_config.findFirst({
      where: { role_code: config.role_code, is_active: true },
    });
    
    if (!existing) {
      await prisma.commission_config.create({
        data: config,
      });
    }
  }

  // Create questions
  console.log('Creating questions...');
  const questions = [
    {
      content: 'What is your monthly income?',
      type: 'number',
      config: { min: 0, placeholder: 'Enter amount in VND' },
    },
    {
      content: 'What is your employment status?',
      type: 'select',
      config: { options: ['Employed', 'Self-employed', 'Unemployed', 'Retired', 'Student'] },
    },
    {
      content: 'How long have you been at your current job?',
      type: 'select',
      config: { options: ['Less than 1 year', '1-3 years', '3-5 years', 'More than 5 years'] },
    },
  ];

  const createdQuestions = [];
  for (const question of questions) {
    const created = await prisma.question.create({
      data: question,
    });
    createdQuestions.push(created);
  }

  // Create a sample service
  console.log('Creating sample service...');
  const docReqs = await prisma.document_requirement.findMany();
  
  const existingService = await prisma.service.findFirst({
    where: { name: 'Personal Loan' },
  });

  if (!existingService) {
    const service = await prisma.service.create({
      data: {
        name: 'Personal Loan',
        description: 'Quick personal loan with flexible terms',
        workflow_id: workflow.id,
      },
    });

    // Link document requirements to service
    for (const doc of docReqs) {
      await prisma.service_document_requirement.create({
        data: {
          service_id: service.id,
          document_requirement_id: doc.id,
          is_required: true,
        },
      });
    }

    // Link questions to service
    for (let i = 0; i < createdQuestions.length; i++) {
      await prisma.service_question.create({
        data: {
          service_id: service.id,
          question_id: createdQuestions[i].id,
          is_required: true,
          sort_order: i,
        },
      });
    }
  }

  // Create admin user
  console.log('Creating admin user...');
  const adminPassword = await bcrypt.hash('Admin@123', 10);
  
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@tadacredit.com' },
    update: {},
    create: {
      email: 'admin@tadacredit.com',
      phone: '0900000000',
      password: adminPassword,
      fullname: 'System Admin',
      gender: 'OTHER',
      birth_date: new Date('1990-01-01'),
      referral_code: 'ADMIN001',
      status: 'ACTIVE',
    },
  });

  // Assign ADMIN role to admin user
  const existingAdminRole = await prisma.user_role.findFirst({
    where: {
      user_id: adminUser.id,
      role_id: createdRoles['ADMIN'].id,
    },
  });

  if (!existingAdminRole) {
    await prisma.user_role.create({
      data: {
        user_id: adminUser.id,
        role_id: createdRoles['ADMIN'].id,
      },
    });
  }

  // Create wallet for admin
  await prisma.wallet.upsert({
    where: { user_id: adminUser.id },
    update: {},
    create: { user_id: adminUser.id },
  });

  // Create system config
  console.log('Creating system config...');
  await prisma.system_config.upsert({
    where: { key: 'otp_required' },
    update: {},
    create: {
      key: 'otp_required',
      value: false,
    },
  });

  console.log('Seed completed successfully!');
  console.log('\nAdmin credentials:');
  console.log('Email: admin@tadacredit.com');
  console.log('Password: Admin@123');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

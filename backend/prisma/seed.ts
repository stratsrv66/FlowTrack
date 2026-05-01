import { PrismaClient, UserRole, ProjectRole, IssuePriority, IssueType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminHash = await bcrypt.hash('Admin@123!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@flowtrack.app' },
    update: {},
    create: {
      email: 'admin@flowtrack.app',
      username: 'admin',
      displayName: 'Admin User',
      passwordHash: adminHash,
      role: UserRole.ADMIN,
    },
  });

  // Create demo user
  const userHash = await bcrypt.hash('User@123!', 12);
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@flowtrack.app' },
    update: {},
    create: {
      email: 'demo@flowtrack.app',
      username: 'demo',
      displayName: 'Demo User',
      passwordHash: userHash,
      role: UserRole.MEMBER,
    },
  });

  // Create demo project
  const project = await prisma.project.upsert({
    where: { key: 'FT' },
    update: {},
    create: {
      name: 'FlowTrack Demo',
      key: 'FT',
      description: 'Demo project for FlowTrack',
    },
  });

  // Add members
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: admin.id } },
    update: {},
    create: { projectId: project.id, userId: admin.id, role: ProjectRole.OWNER },
  });
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: demoUser.id } },
    update: {},
    create: { projectId: project.id, userId: demoUser.id, role: ProjectRole.MEMBER },
  });

  // Create default statuses
  const statusNames = [
    { name: 'To Do', color: '#6B7280', position: 0, isDefault: true },
    { name: 'In Progress', color: '#3B82F6', position: 1 },
    { name: 'In Review', color: '#F59E0B', position: 2 },
    { name: 'Done', color: '#10B981', position: 3, isFinal: true },
    { name: 'Cancelled', color: '#EF4444', position: 4, isFinal: true },
  ];

  const statuses: { [key: string]: string } = {};
  for (const s of statusNames) {
    const status = await prisma.issueStatus.upsert({
      where: { projectId_name: { projectId: project.id, name: s.name } },
      update: {},
      create: { projectId: project.id, ...s },
    });
    statuses[s.name] = status.id;
  }

  // Create default workflow
  const workflow = await prisma.workflow.create({
    data: {
      projectId: project.id,
      name: 'Default Workflow',
      isDefault: true,
      transitions: {
        createMany: {
          data: [
            { fromStatusId: statuses['To Do'], toStatusId: statuses['In Progress'], name: 'Start Progress' },
            { fromStatusId: statuses['In Progress'], toStatusId: statuses['In Review'], name: 'Submit Review' },
            { fromStatusId: statuses['In Review'], toStatusId: statuses['Done'], name: 'Approve' },
            { fromStatusId: statuses['In Review'], toStatusId: statuses['In Progress'], name: 'Request Changes' },
            { fromStatusId: statuses['In Progress'], toStatusId: statuses['Done'], name: 'Complete' },
            { fromStatusId: statuses['To Do'], toStatusId: statuses['Cancelled'], name: 'Cancel' },
            { fromStatusId: statuses['In Progress'], toStatusId: statuses['Cancelled'], name: 'Cancel' },
          ],
          skipDuplicates: true,
        },
      },
    },
  });

  // Create labels
  const labelData = [
    { name: 'frontend', color: '#06B6D4' },
    { name: 'backend', color: '#8B5CF6' },
    { name: 'bug', color: '#EF4444' },
    { name: 'urgent', color: '#F97316' },
    { name: 'documentation', color: '#6B7280' },
  ];
  const labels: { [key: string]: string } = {};
  for (const l of labelData) {
    const label = await prisma.label.upsert({
      where: { projectId_name: { projectId: project.id, name: l.name } },
      update: {},
      create: { projectId: project.id, ...l },
    });
    labels[l.name] = label.id;
  }

  // Create sample issues
  const issueData = [
    { key: 'FT-1', title: 'Setup authentication system', type: IssueType.TASK, priority: IssuePriority.HIGH, statusName: 'Done' },
    { key: 'FT-2', title: 'Implement Kanban board UI', type: IssueType.FEATURE, priority: IssuePriority.HIGH, statusName: 'In Progress' },
    { key: 'FT-3', title: 'Fix login page redirect bug', type: IssueType.BUG, priority: IssuePriority.CRITICAL, statusName: 'To Do' },
    { key: 'FT-4', title: 'Add real-time notifications', type: IssueType.FEATURE, priority: IssuePriority.MEDIUM, statusName: 'To Do' },
    { key: 'FT-5', title: 'Write API documentation', type: IssueType.TASK, priority: IssuePriority.LOW, statusName: 'To Do' },
  ];

  for (const issue of issueData) {
    await prisma.issue.upsert({
      where: { key: issue.key },
      update: {},
      create: {
        key: issue.key,
        title: issue.title,
        type: issue.type,
        priority: issue.priority,
        projectId: project.id,
        statusId: statuses[issue.statusName],
        reporterId: admin.id,
        assigneeId: demoUser.id,
      },
    });
  }

  console.log('✅ Seed complete');
  console.log('📧 Admin: admin@flowtrack.app / Admin@123!');
  console.log('📧 Demo:  demo@flowtrack.app / User@123!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

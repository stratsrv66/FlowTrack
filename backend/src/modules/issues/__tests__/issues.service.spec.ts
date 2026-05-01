import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IssuesService } from '../issues.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProjectsService } from '../../projects/projects.service';
import { WorkflowService } from '../../workflow/workflow.service';
import { RichTextService } from '../../../common/services/rich-text.service';

const mockPrisma = {
  issue: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  project: { findUnique: jest.fn() },
  projectMember: { findUnique: jest.fn() },
  issueStatus: { findFirst: jest.fn() },
};

const mockProjectsService = {
  assertRole: jest.fn(),
};

const mockWorkflowService = {
  canTransition: jest.fn().mockResolvedValue(true),
};

const mockEvents = {
  emit: jest.fn(),
};

const mockRichText = {
  processRichText: jest.fn().mockResolvedValue({ html: '', mentionedUserIds: [] }),
  sanitize: jest.fn((s) => s ?? ''),
};

describe('IssuesService', () => {
  let service: IssuesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IssuesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ProjectsService, useValue: mockProjectsService },
        { provide: WorkflowService, useValue: mockWorkflowService },
        { provide: EventEmitter2, useValue: mockEvents },
        { provide: RichTextService, useValue: mockRichText },
      ],
    }).compile();

    service = module.get<IssuesService>(IssuesService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    const projectId = 'proj-123';
    const userId = 'user-123';
    const dto = {
      title: 'Fix the bug',
      statusId: 'status-123',
    } as any;

    it('should throw ForbiddenException if user is not a member', async () => {
      mockPrisma.projectMember.findUnique.mockResolvedValue(null);

      await expect(service.create(projectId, dto, userId)).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if status does not belong to project', async () => {
      mockPrisma.projectMember.findUnique.mockResolvedValue({ userId, projectId, role: 'MEMBER' });
      mockPrisma.issueStatus.findFirst.mockResolvedValue(null);

      await expect(service.create(projectId, dto, userId)).rejects.toThrow(BadRequestException);
    });

    it('should create issue with sequential key', async () => {
      mockPrisma.projectMember.findUnique.mockResolvedValue({ userId, projectId, role: 'MEMBER' });
      mockPrisma.issueStatus.findFirst.mockResolvedValue({ id: 'status-123', projectId });
      mockPrisma.project.findUnique.mockResolvedValue({ id: projectId, key: 'FT' });
      mockPrisma.issue.count.mockResolvedValue(5);

      const newIssue = { id: 'issue-123', key: 'FT-6', title: dto.title };
      mockPrisma.issue.create.mockResolvedValue(newIssue);

      const result = await service.create(projectId, dto, userId);

      expect(result.key).toBe('FT-6');
      expect(mockEvents.emit).toHaveBeenCalledWith('issue.created', expect.any(Object));
    });
  });

  describe('update', () => {
    it('should throw BadRequestException for invalid workflow transition', async () => {
      const existingIssue = {
        id: 'issue-1', projectId: 'proj-1', statusId: 'status-todo', deletedAt: null,
      };
      mockPrisma.issue.findFirst.mockResolvedValue(existingIssue);
      mockPrisma.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' });
      mockWorkflowService.canTransition.mockResolvedValue(false);

      await expect(
        service.update('issue-1', { statusId: 'status-done' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

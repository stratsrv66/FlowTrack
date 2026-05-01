import { Module } from '@nestjs/common';
import { IssuesService } from './issues.service';
import { IssuesController } from './issues.controller';
import { ProjectsModule } from '../projects/projects.module';
import { WorkflowModule } from '../workflow/workflow.module';

@Module({
  imports: [ProjectsModule, WorkflowModule],
  controllers: [IssuesController],
  providers: [IssuesService],
  exports: [IssuesService],
})
export class IssuesModule {}

import { Global, Module } from '@nestjs/common';
import { RichTextService } from './rich-text.service';

/** Global module exposing RichTextService for HTML sanitization and mention parsing */
@Global()
@Module({
  providers: [RichTextService],
  exports: [RichTextService],
})
export class RichTextModule {}

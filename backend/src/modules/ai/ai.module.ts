import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { AiContextService } from './ai-context.service';
import { AiLlmService } from './ai-llm.service';

@Module({
  imports: [AuthModule],
  controllers: [AiController],
  providers: [AiService, AiContextService, AiLlmService],
  exports: [AiService],
})
export class AiModule {}

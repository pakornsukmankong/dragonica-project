import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SkillController } from './skill.controller';
import { SkillService } from './skill.service';

@Module({
  imports: [AuthModule],
  controllers: [SkillController],
  providers: [SkillService],
  exports: [SkillService],
})
export class SkillModule {}

import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CharacterController } from './character.controller';
import { CharacterService } from './character.service';

@Module({
  imports: [AuthModule],
  controllers: [CharacterController],
  providers: [CharacterService],
  exports: [CharacterService],
})
export class CharacterModule {}

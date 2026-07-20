import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ItemCodeController } from './item-code.controller';
import { ItemCodeService } from './item-code.service';

@Module({
  imports: [AuthModule],
  controllers: [ItemCodeController],
  providers: [ItemCodeService],
  exports: [ItemCodeService],
})
export class ItemCodeModule {}

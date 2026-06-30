import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './admin.controller';
import { PublicDataController } from './public.controller';
import { UploadController } from './upload.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from '../auth/guards/admin.guard';

@Module({
  imports: [
    AuthModule,
    MulterModule.register({ limits: { fileSize: 5 * 1024 * 1024 } }),
  ],
  controllers: [AdminController, PublicDataController, UploadController],
  providers: [AdminService, AdminGuard],
})
export class AdminModule {}

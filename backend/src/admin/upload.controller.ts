import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { SupabaseService } from '../supabase/supabase.service';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

@Controller('admin/upload')
@UseGuards(JwtAuthGuard, AdminGuard)
export class UploadController {
  constructor(private readonly supabase: SupabaseService) {}

  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Use PNG, JPEG, WebP, or GIF',
      );
    }

    const ext = file.originalname.split('.').pop() ?? 'png';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const path = `images/${filename}`;

    const { error: uploadError } = await this.supabase.storage
      .from('assets')
      .upload(path, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      throw new BadRequestException(`Upload failed: ${uploadError.message}`);
    }

    const { data } = this.supabase.storage.from('assets').getPublicUrl(path);

    return { url: data.publicUrl };
  }
}

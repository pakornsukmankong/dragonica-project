import { Controller, Get } from '@nestjs/common';
import { YoutubeService } from './youtube.service';

// Public read-only channel stats — no user data, no auth needed.
@Controller('youtube')
export class YoutubeController {
  constructor(private readonly youtubeService: YoutubeService) {}

  @Get('channel')
  channel() {
    return this.youtubeService.getChannel();
  }
}

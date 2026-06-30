import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  async getMe(@CurrentUser() user: JwtPayload) {
    const profile = await this.authService.getOrCreateProfile(
      user.sub,
      user.email,
    );

    return {
      id: profile.id,
      email: user.email,
      username: profile.username,
      avatarUrl: profile.avatar_url,
    };
  }

  @Patch('me')
  async updateMe(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    // Make sure a row exists before patching (first-time OAuth users).
    await this.authService.getOrCreateProfile(user.sub, user.email);
    const profile = await this.authService.updateProfile(user.sub, dto);

    return {
      id: profile.id,
      email: user.email,
      username: profile.username,
      avatarUrl: profile.avatar_url,
    };
  }
}

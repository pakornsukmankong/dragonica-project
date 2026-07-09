import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import {
  I18nModule,
  AcceptLanguageResolver,
  QueryResolver,
  HeaderResolver,
} from 'nestjs-i18n';
import { join } from 'path';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { CharacterModule } from './character/character.module';
import { SessionModule } from './session/session.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AdminModule } from './admin/admin.module';
import { DonationModule } from './donation/donation.module';
import { TicketModule } from './ticket/ticket.module';
import { SkillModule } from './skill/skill.module';
import { YoutubeModule } from './youtube/youtube.module';
import { StatsModule } from './stats/stats.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // i18n: pick the response language from the client. The frontend sends the
    // active locale via Accept-Language; ?lang= and x-lang are also accepted.
    I18nModule.forRoot({
      fallbackLanguage: 'en',
      loaderOptions: {
        path: join(__dirname, '/i18n/'),
        watch: true,
      },
      resolvers: [
        { use: QueryResolver, options: ['lang'] },
        new HeaderResolver(['x-lang']),
        AcceptLanguageResolver,
      ],
    }),
    // Global rate limit: 100 requests per minute per IP.
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    SupabaseModule,
    AuthModule,
    CharacterModule,
    SessionModule,
    DashboardModule,
    AdminModule,
    DonationModule,
    TicketModule,
    SkillModule,
    YoutubeModule,
    StatsModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

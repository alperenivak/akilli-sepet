import { Controller, Get, Patch, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Bildirimlerimi listele' })
  getMyNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.notificationsService.getUserNotifications(user.id, page, limit);
  }

  @Patch('read')
  @ApiOperation({ summary: 'Bildirimleri okundu olarak isaretLE' })
  markAsRead(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { notificationIds?: string[] },
  ) {
    return this.notificationsService.markAsRead(user.id, body.notificationIds);
  }
}

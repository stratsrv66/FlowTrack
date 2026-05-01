import {
  Controller, Get, Patch, Param, Query, ParseBoolPipe, DefaultValuePipe,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CursorPaginationDto } from '../../common/utils/pagination.util';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * GET /notifications
   * @query onlyUnread=true
   * Returns paginated notifications for the current user
   */
  @Get()
  findAll(
    @CurrentUser('id') userId: string,
    @Query('onlyUnread', new DefaultValuePipe(false), ParseBoolPipe) onlyUnread: boolean,
    @Query() pagination: CursorPaginationDto,
  ) {
    return this.notificationsService.findAll(userId, onlyUnread, pagination);
  }

  /**
   * PATCH /notifications/:id/read
   * Marks a single notification as read
   */
  @Patch(':id/read')
  markRead(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.notificationsService.markRead(id, userId);
  }

  /**
   * PATCH /notifications/read-all
   * Marks all notifications as read
   */
  @Patch('read-all')
  markAllRead(@CurrentUser('id') userId: string) {
    return this.notificationsService.markAllRead(userId);
  }
}

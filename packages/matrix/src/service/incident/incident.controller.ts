import { Controller, Logger, Post, Body } from '@nestjs/common';
import { MatrixBot } from '../../lib/matrix-bot';

@Controller('notifications')
export class IncidentController {
  private logger: Logger = new Logger(IncidentController.name);

  constructor(private matrixBot: MatrixBot) {}

  @Post()
  async sendNotification(@Body() notification: { channelId: string; message: string }) {
    this.logger.log(`Received notification request for channel ${notification.channelId}`);
    await this.matrixBot.sendMessage(notification.channelId, notification.message);
    return { success: true };
  }
}

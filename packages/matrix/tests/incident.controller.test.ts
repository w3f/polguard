import { Test, TestingModule } from '@nestjs/testing';
import { IncidentController } from '../src/service/incident/incident.controller';
import { MatrixBot } from '../src/lib/matrix-bot';
import { Logger } from '@nestjs/common';

describe('IncidentController', () => {
  let controller: IncidentController;
  let matrixBotMock: Partial<MatrixBot>;

  beforeEach(async () => {
    matrixBotMock = {
      sendMessage: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [IncidentController],
      providers: [
        {
          provide: MatrixBot,
          useValue: matrixBotMock,
        },
        Logger,
      ],
    }).compile();

    controller = module.get<IncidentController>(IncidentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should send notification to matrix', async () => {
    const notification = {
      channelId: 'test-channel',
      message: 'Test message',
    };

    const result = await controller.sendNotification(notification);

    expect(result).toEqual({ success: true });
    expect(matrixBotMock.sendMessage).toHaveBeenCalledWith(
      notification.channelId,
      notification.message,
    );
  });

});

import { Injectable } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { IncidentEvent } from '@lib/interfaces';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class IncidentEventHandlerService {
  constructor(private eventEmitter: EventEmitter2) {}

  @MessagePattern('incident.new')
  handleIncidentEvent(event: IncidentEvent) {
    this.eventEmitter.emit('incident.new', event);
  }
}

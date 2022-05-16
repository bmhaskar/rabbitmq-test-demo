import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { AppAnotherService } from './app.another.service';
import { MessagePattern } from '@nestjs/microservices';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly appAnotherService: AppAnotherService,
  ) {}

  @MessagePattern('hello')
  getHelloMessage(data: unknown): string {
    return this.appService.getHello();
  }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get()
  getAnotherHello(): string {
    return this.appAnotherService.getHello();
  }
}

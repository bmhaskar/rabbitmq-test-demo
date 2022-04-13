import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { AppAnotherService } from './app.another.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly appAnotherService: AppAnotherService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get()
  getAnotherHello(): string {
    return this.appAnotherService.getHello();
  }
}

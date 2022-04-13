import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { ModuleMocker } from 'jest-mock';
import { AppService } from "./app.service";
import { AppAnotherService } from "./app.another.service";

const moduleMocker = new ModuleMocker(global);

describe('AppController', () => {
  let appController: AppController;
  let appAnotherService: AppAnotherService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    })
      .useMocker(createMock)
      .compile();

    appController = app.get<AppController>(AppController);
    appAnotherService = app.get<AppAnotherService>(AppAnotherService)
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
    it('should have mocked service', () => {
      const getHelloReturnValue = 'Hello world!';
      const mockedAppAnotherService = appAnotherService as DeepMocked<AppAnotherService>
      mockedAppAnotherService.getHello.mockReturnValue(getHelloReturnValue);
      expect(mockedAppAnotherService.getHello()).toBe(getHelloReturnValue)
    })
  });
});
